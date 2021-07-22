package compensator

import (
	"context"
	"sync"
)

var ctxMap map[context.Context]interface{}
var mx sync.Mutex

func init() {
	ctxMap = make(map[context.Context]interface{})
}

func AddToMap(ctx context.Context, val interface{}) {
	mx.Lock()
	defer mx.Unlock()

	ctxMap[ctx] = val
}

func Load(ctx context.Context) interface{} {
	mx.Lock()
	defer mx.Unlock()

	out, ok := ctxMap[ctx]
	if !ok {
		return nil
	}

	return out
}

func Delete(ctx context.Context) {
	mx.Lock()
	defer mx.Unlock()

	delete(ctxMap, ctx)
}
