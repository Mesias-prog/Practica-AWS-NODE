// Repositorio de empleados sobre MongoDB Atlas (mongoose).
const { isValidObjectId } = require('mongoose');
const Empleado = require('../models/empleado.model');

const SEMILLA = [
  { nombre: 'Ana Torres', cargo: 'Desarrolladora Backend', salario: 1800 },
  { nombre: 'Luis Andrade', cargo: 'DevOps', salario: 2000 }
];

module.exports = {
  tipo: 'mongodb',

  async inicializar() {
    // Datos de ejemplo solo si la colección está vacía (upsert: seguro con varias instancias del clúster)
    if ((await Empleado.estimatedDocumentCount()) === 0) {
      await Empleado.bulkWrite(
        SEMILLA.map((e) => ({ updateOne: { filter: { nombre: e.nombre }, update: { $setOnInsert: e }, upsert: true } }))
      );
    }
  },

  async listar() {
    return Empleado.find().sort({ createdAt: 1 });
  },

  async obtener(id) {
    return isValidObjectId(id) ? Empleado.findById(id) : null;
  },

  async crear(datos) {
    return Empleado.create(datos);
  },

  async actualizar(id, datos) {
    if (!isValidObjectId(id)) return null;
    return Empleado.findByIdAndUpdate(id, datos, { new: true, runValidators: true });
  },

  async eliminar(id) {
    if (!isValidObjectId(id)) return false;
    return Boolean(await Empleado.findByIdAndDelete(id));
  }
};
