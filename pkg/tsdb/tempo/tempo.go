package tempo

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/compensator"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/oauthtoken"

	ot_pdata "go.opentelemetry.io/collector/consumer/pdata"
)

type tempoExecutor struct {
	httpClient *http.Client
}

// NewExecutor returns a tempoExecutor.
//nolint: staticcheck // plugins.DataPlugin deprecated
func New(httpClientProvider httpclient.Provider) func(*models.DataSource) (plugins.DataPlugin, error) {
	//nolint: staticcheck // plugins.DataPlugin deprecated
	return func(dsInfo *models.DataSource) (plugins.DataPlugin, error) {
		httpClient, err := dsInfo.GetHTTPClient(httpClientProvider)
		if err != nil {
			return nil, err
		}

		return &tempoExecutor{
			httpClient: httpClient,
		}, nil
	}
}

var (
	tlog = log.New("tsdb.tempo")
)

//nolint: staticcheck // plugins.DataQuery deprecated
func (e *tempoExecutor) DataQuery(ctx context.Context, dsInfo *models.DataSource,
	queryContext plugins.DataQuery) (plugins.DataResponse, error) {
	refID := queryContext.Queries[0].RefID
	queryResult := plugins.DataQueryResult{}
	traceID := queryContext.Queries[0].Model.Get("query").MustString("")

	req, err := e.createRequest(ctx, dsInfo, traceID)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return plugins.DataResponse{}, fmt.Errorf("failed get to tempo: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			tlog.Warn("failed to close response body", "err", err)
		}
	}()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return plugins.DataResponse{}, err
	}

	if resp.StatusCode != http.StatusOK {
		queryResult.Error = fmt.Errorf("failed to get trace with id: %s Status: %s Body: %s", traceID, resp.Status, string(body))
		return plugins.DataResponse{
			Results: map[string]plugins.DataQueryResult{
				refID: queryResult,
			},
		}, nil
	}

	otTrace, err := ot_pdata.TracesFromOtlpProtoBytes(body)

	if err != nil {
		return plugins.DataResponse{}, fmt.Errorf("failed to convert tempo response to Otlp: %w", err)
	}

	frame, err := TraceToFrame(otTrace)
	if err != nil {
		return plugins.DataResponse{}, fmt.Errorf("failed to transform trace %v to data frame: %w", traceID, err)
	}
	frame.RefID = refID
	frames := []*data.Frame{frame}
	queryResult.Dataframes = plugins.NewDecodedDataFrames(frames)

	return plugins.DataResponse{
		Results: map[string]plugins.DataQueryResult{
			refID: queryResult,
		},
	}, nil
}

func (e *tempoExecutor) createRequest(ctx context.Context, dsInfo *models.DataSource, traceID string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", dsInfo.Url+"/api/traces/"+traceID, nil)
	if err != nil {
		return nil, err
	}

	if dsInfo.BasicAuth {
		req.SetBasicAuth(dsInfo.BasicAuthUser, dsInfo.DecryptedBasicAuthPassword())
	}

	if oauthtoken.IsOAuthPassThruEnabled(dsInfo) {
		tlog.Debug("Configuring oauth passthru")
		dCtx := compensator.Load(ctx)
		if dCtx == nil {
			return nil, fmt.Errorf("request context not found; unable to configure oauth passthru")
		}

		c, ok := dCtx.(*models.ReqContext)
		if !ok {
			return nil, fmt.Errorf("invalid request context object")
		}

		if token := oauthtoken.GetCurrentOAuthToken(c.Req.Context(), c.SignedInUser); token != nil {
			tlog.Debug("Setting 'Authorization' header from oauth credentials")
			req.Header.Set("Authorization", fmt.Sprintf("%s %s", token.Type(), token.AccessToken))
		}
	}

	req.Header.Set("Accept", "application/protobuf")

	tlog.Debug("Tempo request", "url", req.URL.String(), "headers", req.Header)
	return req, nil
}
