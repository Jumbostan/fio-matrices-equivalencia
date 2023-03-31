const util = require('util');

const informix = require('informixdb');
const { CONNECTION_STRING } = require('../config/informix');

const openConn = util.promisify(informix.open);

//realiza una consulta a la DB
const consultaDB = async (sql, params) => {
  try {
    const conn = await openConn(CONNECTION_STRING);
    const rows = await conn.query(sql, params);

    await conn.close();
    return { rows };
  } catch (error) {
    return { error: true, msg: error };
  }
};

module.exports = { consultaDB };
