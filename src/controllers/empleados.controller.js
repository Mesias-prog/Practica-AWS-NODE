// Almacenamiento en memoria: cada instancia del clúster de PM2 tiene su propia copia.
// En producción real se usaría una base de datos externa (AWS RDS / DynamoDB).
let empleados = [
  { id: 1, nombre: 'Ana Torres', cargo: 'Desarrolladora Backend', salario: 1800 },
  { id: 2, nombre: 'Luis Andrade', cargo: 'DevOps', salario: 2000 }
];
let siguienteId = 3;

function validar(body) {
  const { nombre, cargo, salario } = body || {};
  if (typeof nombre !== 'string' || !nombre.trim()) return 'El campo "nombre" es obligatorio';
  if (typeof cargo !== 'string' || !cargo.trim()) return 'El campo "cargo" es obligatorio';
  if (salario !== undefined && (typeof salario !== 'number' || salario < 0)) {
    return 'El campo "salario" debe ser un número positivo';
  }
  return null;
}

function buscar(req, res) {
  const empleado = empleados.find((e) => e.id === Number(req.params.id));
  if (!empleado) res.status(404).json({ error: 'Empleado no encontrado' });
  return empleado;
}

exports.listar = (req, res) => {
  res.json(empleados);
};

exports.obtener = (req, res) => {
  const empleado = buscar(req, res);
  if (empleado) res.json(empleado);
};

exports.crear = (req, res) => {
  const error = validar(req.body);
  if (error) return res.status(400).json({ error });
  const { nombre, cargo, salario = 0 } = req.body;
  const nuevo = { id: siguienteId++, nombre: nombre.trim(), cargo: cargo.trim(), salario };
  empleados.push(nuevo);
  res.status(201).json(nuevo);
};

exports.actualizar = (req, res) => {
  const empleado = buscar(req, res);
  if (!empleado) return;
  const error = validar(req.body);
  if (error) return res.status(400).json({ error });
  const { nombre, cargo, salario = empleado.salario } = req.body;
  Object.assign(empleado, { nombre: nombre.trim(), cargo: cargo.trim(), salario });
  res.json(empleado);
};

exports.eliminar = (req, res) => {
  const empleado = buscar(req, res);
  if (!empleado) return;
  empleados = empleados.filter((e) => e.id !== empleado.id);
  res.status(204).end();
};
