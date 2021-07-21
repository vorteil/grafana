import { AlertingUIDataSourceJsonData, DataSourcePluginOptionsEditorProps, DataSourceSettings } from '@grafana/data';
import React from 'react';
import { Switch } from '../Forms/Legacy/Switch/Switch';
import { DataSourceHttpSettings } from './DataSourceHttpSettings';

type Props<T> = Pick<DataSourcePluginOptionsEditorProps<T>, 'options' | 'onOptionsChange'> & {
  sigV4AuthEnabled: boolean;
};

export function AlertingSettings<T extends AlertingUIDataSourceJsonData>({
  options,
  onOptionsChange,
  sigV4AuthEnabled,
}: Props<T>): JSX.Element {
  return (
    <>
      <h3 className="page-heading">Alerting</h3>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <Switch
            label="Manage alerts via Alerting UI"
            labelClass="width-13"
            checked={options.jsonData.manageAlerts !== false}
            onChange={(event) =>
              onOptionsChange({
                ...options,
                jsonData: { ...options.jsonData, manageAlerts: event!.currentTarget.checked },
              })
            }
          />
        </div>
        <div className="gf-form-inline">
          <Switch
            label="Custom ruler URL"
            labelClass="width-13"
            checked={options.jsonData.useCustomRulerURL === true}
            onChange={(event) =>
              onOptionsChange({
                ...options,
                jsonData: {
                  ...options.jsonData,
                  useCustomRulerURL: event!.currentTarget.checked,
                  ruler: event!.currentTarget.checked ? options.jsonData.ruler : undefined,
                },
              })
            }
          />
        </div>
      </div>
      {!!options.jsonData.useCustomRulerURL && (
        <div className="page-body">
          <DataSourceHttpSettings
            title="Ruler"
            defaultUrl="http://localhost:9090/ruler"
            dataSourceConfig={dataSourceSettingsToRulerHTTPDataSourceSettings(options)}
            showAccessOptions={false}
            onChange={(data) => onOptionsChange(mergeInRulerHTTPDataSourceSettings(options, data))}
            sigV4AuthToggleEnabled={sigV4AuthEnabled}
          />
        </div>
      )}
    </>
  );
}

function dataSourceSettingsToRulerHTTPDataSourceSettings(
  settings: DataSourceSettings<any, any>
): DataSourceSettings<any, any> {
  const {
    url = '',
    basicAuth = false,
    withCredentials = false,
    basicAuthPassword = '',
    basicAuthUser = '',
    ...jsonData
  } = settings.jsonData.ruler ?? {};
  return {
    ...settings,
    url,
    basicAuth,
    withCredentials,
    basicAuthPassword,
    basicAuthUser,
    jsonData,
    secureJsonData:
      settings.secureJsonData?.rulerBasicAuthPassword !== undefined
        ? {
            basicAuthPassword: settings.secureJsonData.rulerBasicAuthPassword,
          }
        : {},
    secureJsonFields: {
      basicAuthPassword: settings.secureJsonFields.rulerBasicAuthPassword,
    },
  };
}

function mergeInRulerHTTPDataSourceSettings(
  settings: DataSourceSettings<any, any>,
  rulerHTTPSettings: DataSourceSettings<any, any>
): DataSourceSettings<any, any> {
  const out = {
    ...settings,
    jsonData: {
      ...settings.jsonData,
      ruler: {
        ...rulerHTTPSettings.jsonData,
        url: rulerHTTPSettings.url,
        basicAuth: rulerHTTPSettings.basicAuth,
        basicAuthPassword: rulerHTTPSettings.basicAuthPassword,
        basicAuthUser: rulerHTTPSettings.basicAuthUser,
        withCredentials: rulerHTTPSettings.withCredentials,
      },
    },
    secureJsonFields: {
      ...settings.secureJsonFields,
      rulerBasicAuthPassword: rulerHTTPSettings.secureJsonFields.basicAuthPassword,
    },
    secureJsonData: {
      ...settings.secureJsonData,
      rulerBasicAuthPassword: rulerHTTPSettings.secureJsonData?.basicAuthPassword,
    },
  };
  return out;
}
