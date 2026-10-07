const db = require('../db');

function validar(body) {
  const { nombre, cargo, salario } = body || {};
  if (typeof nombre !== 'string' || !nombre.trim()) return 'El campo "nombre" es obligatorio';
  if (typeof cargo !== 'string' || !cargo.trim()) return 'El campo "cargo" es obligatorio';
  if (salario !== undefined && (typeof salario !== 'number' || salario < 0)) {
    return 'El campo "salario" debe ser un número positivo';
  }
  return null;
}

function datosDe(body) {
  const datos = { nombre: body.nombre.trim(), cargo: body.cargo.trim() };
  if (body.salario !== undefined) datos.salario = body.salario;
  return datos;
}

const noEncontrado = (res) => res.status(404).json({ error: 'Empleado no encontrado' });

exports.listar = async (req, res) => {
  res.json(await db.empleados.listar());
};

exports.obtener = async (req, res) => {
  const empleado = await db.empleados.obtener(req.params.id);
  if (!empleado) return noEncontrado(res);
  res.json(empleado);
};

exports.crear = async (req, res) => {
  const error = validar(req.body);
  if (error) return res.status(400).json({ error });
  res.status(201).json(await db.empleados.crear(datosDe(req.body)));
};

exports.actualizar = async (req, res) => {
  const error = validar(req.body);
  if (error) return res.status(400).json({ error });
  const empleado = await db.empleados.actualizar(req.params.id, datosDe(req.body));
  if (!empleado) return noEncontrado(res);
  res.json(empleado);
};

exports.eliminar = async (req, res) => {
  if (!(await db.empleados.eliminar(req.params.id))) return noEncontrado(res);
  res.status(204).end();
};
