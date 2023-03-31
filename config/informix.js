const SERVER = process.env.IFX_SERVER;
const DATABASE = process.env.IFX_DATABASE;
const HOST = process.env.IFX_HOST;
const SERVICE = process.env.IFX_SERVICE;
const UID = process.env.IFX_UID;
const PWD = process.env.IFX_PWD;
const CLIENT_LOCALE = process.env.IFX_CLIENT_LOCALE;

const CONNECTION_STRING = `SERVER=${SERVER};DATABASE=${DATABASE};HOST=${HOST};SERVICE=${SERVICE};UID=${UID};PWD=${PWD};CLIENT_LOCALE=${CLIENT_LOCALE}`;

module.exports = { CONNECTION_STRING };
