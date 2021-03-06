import _ from 'lodash';

// TODO: cache somewhere for speed
export const getPkCols = (table) => _
    .sortBy(table.columns, o => o.pkOrdinal)
    .filter(col => col.pkOrdinal !== undefined)
    .map(col => col.name);

// TODO: super slow, cache
export const getRowByPk = (pk, table) => table.rows.find(row => arrayEq(pk, getPk(row, table)));

export const getPk = (rec, table) => getPkCols(table).map(key => rec[key]);

export const arrayEq = (a, b) => _.range(Math.max(a.length, b.length))
    .reduce((acc, cur) => acc && a[cur] === b[cur], true);

export const deleteRow = (row, table) => {
    const pk = getPk(row, table);
    table.rows = table.rows.filter(row => !arrayEq(pk, getPk(row, table)));
};

export const upsertRow = (row, table) => {
    deleteRow(row, table);
    table.rows.push({...row});
};

export const canInsert = (row, table) => {
    const pk = getPk(row, table);
    const oldRow = getRowByPk(pk, table);
    return oldRow === undefined;
};

export const canDelete = (row, table) => {
    const pk = getPk(row, table);
    const oldRow = getRowByPk(pk, table);
    return row.prvTxnId === oldRow.curTxnId;
};

export const canUpdate = (row, table) => {
    const pk = getPk(row, table);
    const oldRow = getRowByPk(pk, table);
    return oldRow !== undefined && row.prvTxnId === oldRow.curTxnId;
};

export const rollbackLog = (state) => {
    const newState = _
        .range(state.log.length)
        .reverse()
        .map(idx => state.log[idx])
        .map(txn => invert(txn))
        .reduce((acc, cur) => applyCommit(acc, cur, false), state);
    return {...newState, log: []};
};

const inverse = {
    "INSERT": "DELETE",
    "UPDATE": "UPDATE",
    "DELETE": "INSERT"
};

export const invert = (txn) => {
    const changes = txn.changes.map(change => {
        return {
            ...change,
            type: inverse[change.type],
            record: change.prior ? change.prior : change.record,
            prior: change.prior ? change.record : change.prior
        }
    });
    return {...txn, changes};
};

export const validateCommit = (state, txn) => {
    return txn.changes.reduce((acc, cur) => acc && validateChange(txn, state, cur), true);
};

export const applyCommit = (state, txn, validate = true) => {
    if (validate === true && validateCommit(state, txn) !== true) {
        console.log('Conflict while applying local commit txnId=', txn.id);
        return state;
    }
    const newState = JSON.parse(JSON.stringify(state));
    txn.changes.reduce((acc, cur) => acc && applyChange(txn, newState, cur), true);
    newState.log.push(JSON.parse(JSON.stringify(txn)));
    return newState;
};

const validators = {
    'INSERT': canInsert,
    'UPDATE': canUpdate,
    'DELETE': canDelete
};

const validateChange = (txn, state, change) => {
    const table = state.tables[change.table];
    const func = validators[change.type];
    return func(change.record, table);
};

const handlers = {
    'INSERT': upsertRow,
    'UPDATE': upsertRow,
    'DELETE': deleteRow
};

const applyChange = (txn, state, change) => {
    const table = state.tables[change.table];
    const func = handlers[change.type];
    func(change.record, table);
};
