export const createIndexedDbSyncer = (db) => {
    const indexedDbSyncer = () => {
        const wrapDispatch = (next) => {
            const dispatch = (action) => {
                try {
                    switch (action.type) {
                        case 'CLEAR_DB':
                            clearDb(db);
                            break;
                        case 'COMMIT':
                            saveCommit(db, action.txn);
                            return next(action);
                        case 'SNAP':
                            saveSnapshot(db, action.payload);
                            return next(action);
                        default:
                            return next(action);
                    }
                } catch (ex) {
                    // TODO: retry on reconnect
                    console.error("Error committing to IndexedDb!", ex);
                }
            };
            return dispatch;
        };
        return wrapDispatch;
    };
    return indexedDbSyncer;
};

const clearDb = async (db) => {
    await db.clear();
    // window.location.reload();
};

const saveCommit = async (db, txn) => {
    console.log(`Saving txn ${txn.id} to IndexedDB...`);
};

const saveSnapshot = async (db, snapshot) => {
    console.log(`Saving snapshot ${snapshot.lsn} to IndexedDB...`);
    const metadata = await db.getMetadata();
    metadata.lsn = snapshot.lsn;
    db.setMetadata(metadata);
    db.saveSnapshot(snapshot);
};