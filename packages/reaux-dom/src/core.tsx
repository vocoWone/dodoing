import React, {ComponentType} from "react";
import ReactDOM from "react-dom";
import {withRouter} from "react-router-dom";
import {Reducer, compose, StoreEnhancer, Store, applyMiddleware, createStore} from "redux";
import {Provider} from "react-redux";
import {connectRouter, routerMiddleware, ConnectedRouter, push} from "connected-react-router";
import {createBrowserHistory} from "history";
import createSagaMiddleware from "redux-saga";
import {createReducer, ErrorBoundary, setErrorAction, createView, createAction, createApp, modelInjection, BaseOnGeneratorModel, BaseOnPromiseModel, BaseModel, ModelType, saga, App} from "reaux";
import {StateView, RenderOptions} from "./type";

console.time("[framework] initialized");

const history = createBrowserHistory();
const app = generateApp();
modelInjection(app);

/**
 * Create history, reducer, middleware, store, redux-saga, app cache
 */
function generateApp(): App {
    const reducer: Reducer<StateView> = createReducer(reducers => ({...reducers, router: connectRouter(history)}));
    console.log(reducer);
    const historyMiddleware = routerMiddleware(history);
    const sagaMiddleware = createSagaMiddleware();
    const store: Store<StateView> = createStore(reducer, devtools(applyMiddleware(historyMiddleware, sagaMiddleware)));
    const app = createApp(store);
    sagaMiddleware.run(saga, app);
    // TODO:
    // pMiddleware.run(app);
    // gMiddleware.run(app);
    return app;
}

/**
 * Start react-dom render.
 * Project entry, trigger once. e.g: main module.
 * @param options
 */
export function start(options: RenderOptions): void {
    const {Component, onError, onInitialized} = options;
    if (typeof onError === "function") {
        app.exceptionHandler.onError = onError.bind(app);
    }
    listenGlobalError();
    const rootElement: HTMLDivElement = document.createElement("div");
    rootElement.id = "framework-app-root";
    document.body.appendChild(rootElement);
    const WithRouterComponent = withRouter(Component as any);
    ReactDOM.render(
        <Provider store={app.store}>
            <ErrorBoundary setErrorAction={setErrorAction}>
                <ConnectedRouter history={history}>
                    <WithRouterComponent />
                </ConnectedRouter>
            </ErrorBoundary>
        </Provider>,
        rootElement,
        () => {
            console.timeEnd("[framework] initialized");
            if (typeof onInitialized === "function") {
                onInitialized();
            }
        }
    );
}

/**
 * Register module create View and actions.
 * Trigger in every module.
 * @param handler
 * @param Component
 */
export function register<H extends BaseModel & {type: ModelType}>(handler: H, Component: ComponentType<any>) {
    if (app.modules.hasOwnProperty(handler.moduleName)) {
        throw new Error(`module is already registered, module=${handler.moduleName}`);
    }
    app.modules[handler.moduleName] = true;
    const {actions, actionHandlers} = createAction(handler);
    app.actionHandlers = {...app.actionHandlers, ...actionHandlers};

    if (handler.type === ModelType.P) {
        app.actionPHandlers = {...app.actionPHandlers, ...actionHandlers};
    } else if (handler.type === ModelType.G) {
        app.actionGHandlers = {...app.actionGHandlers, ...actionHandlers};
    }

    const View = createView(handler, Component);
    return {View, actions};
}

/**
 * Module extends Generator Model
 */
export class GModel<State extends {} = {}> extends BaseOnGeneratorModel<State> {
    setHistory(newURL: string) {
        app.store.dispatch(push(newURL));
    }
}

/**
 * Module extends Promise Model
 */
export class PModel<State extends {} = {}> extends BaseOnPromiseModel<State> {
    setHistory(newURL: string) {
        app.store.dispatch(push(newURL));
    }
}

/**
 * Listen global error
 */
function listenGlobalError() {
    window.onerror = (message: string | Event, source?: string, line?: number, column?: number, error?: Error): void => {
        console.error("Window Global Error");
        if (!error) {
            error = new Error(message.toString());
        }
        app.store.dispatch(setErrorAction(error));
    };
}

/**
 * Redux DevTools plug-in support
 * Ref: https://github.com/zalmoxisus/redux-devtools-extension/blob/master/docs/API/Arguments.md
 * @param enhancer
 */
function devtools(enhancer: StoreEnhancer): StoreEnhancer {
    const extension = (window as any).__REDUX_DEVTOOLS_EXTENSION__;
    if (extension) {
        return compose(
            enhancer,
            extension({})
        );
    }
    return enhancer;
}
