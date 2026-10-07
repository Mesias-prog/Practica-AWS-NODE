const mongoose = require('mongoose');

// Patrón Repositorio: el controlador usa siempre la misma interfaz y aquí se decide
// si los datos viven en MongoDB Atlas (producción) o en memoria (desarrollo/pruebas).
let repositorio = require('./repositories/empleados.memory');

async function conectar(uri = process.env.MONGODB_URI) {
  if (uri) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log(`MongoDB conectado: ${mongoose.connection.host}/${mongoose.connection.name}`);
    repositorio = require('./repositories/empleados.mongo');
  } else {
    console.warn('MONGODB_URI no definida: usando almacenamiento en memoria (los datos no persisten)');
  }
  await repositorio.inicializar();
  return repositorio;
}

function estado() {
  if (repositorio.tipo === 'memoria') return { tipo: 'memoria', conectado: true };
  return {
    tipo: 'mongodb',
    conectado: mongoose.connection.readyState === 1,
    base: mongoose.connection.name
  };
}

async function desconectar() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

module.exports = {
  conectar,
  desconectar,
  estado,
  get empleados() {
    return repositorio;
  }
};
