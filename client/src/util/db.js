import _ from 'lodash';

// TODO: cache somewhere for speed
export const getPkCols = (table) => _
    .sortBy(table.columns, o => o.pkOrdinal)
    .filter(col => col.pkOrdinal !== undefined)
    .map(col => col.name);

// TODO: super slow, cache
export const getRowByPk = (pk, table) => table.rows.find(row => arrayEq(pk, getPk(row, table)));

export const getPk = (rec, table) => getPkCols(table).map(key => rec[key]);

export const arrayEq = (a,b) => _.range(Math.max(a.length, b.length))
    .reduce((acc, cur) => acc && a[cur] === b[cur], true);

export const removeRow = (row, table) => {
    const pk = getPk(row, table);
    table.rows = table.rows.filter(row => !arrayEq(pk, getPk(row, table)));
};

export const updateRow = (row, table) => {
    const pk = getPk(row, table);
    table.rows = table.rows.map(r => arrayEq(pk, getPk(r, table)) ? row : r);
};