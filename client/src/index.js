import React from 'react';
import ReactDOM from 'react-dom';
import {applyMiddleware, createStore} from 'redux';
import {Provider} from 'react-redux';

import './index.css';
import App from './containers/App';
import {createWebSocketSender} from './middleware/webSocketSender';
import createReducer from './reducers';
import SocketService from './SocketService';
import Database from "./Database";
import {createIndexedDbSyncer} from "./middleware/indexedDbSyncer";

const elementIds = ['leftRoot', 'rightRoot'];
elementIds.forEach((elementId) => {

    const init = async () => {
        const db = new Database(elementId);
        await db.connect();
        const metadata = await db.getMetadataOrDefault();
        const reducer = createReducer(metadata);

        const ws = new SocketService();
        ws.onConnect = () => ws.write({type: 'HELLO', payload: ws.id});
        const socketSender = createWebSocketSender(ws);
        const dbSyncer = createIndexedDbSyncer(db);
        const store = createStore(reducer, applyMiddleware(socketSender, dbSyncer));
        ws.onMsg = (msg) => store.dispatch(msg);
        ws.connect();

        ReactDOM.render(
            <Provider store={store}>
                <App name={elementId}/>
            </Provider>
            , document.getElementById(elementId)
        );
    };
    init();
});
