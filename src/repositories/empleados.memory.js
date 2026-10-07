// Repositorio en memoria: solo para desarrollo y pruebas sin base de datos.
// Cada instancia del clúster de PM2 tiene su propia copia y se pierde al reiniciar.
let empleados = [];
let siguienteId = 1;

module.exports = {
  tipo: 'memoria',

  async inicializar() {
    empleados = [
      { id: '1', nombre: 'Ana Torres', cargo: 'Desarrolladora Backend', salario: 1800 },
      { id: '2', nombre: 'Luis Andrade', cargo: 'DevOps', salario: 2000 }
    ];
    siguienteId = 3;
  },

  async listar() {
    return empleados;
  },

  async obtener(id) {
    return empleados.find((e) => e.id === String(id)) || null;
  },

  async crear(datos) {
    const nuevo = { id: String(siguienteId++), salario: 0, ...datos };
    empleados.push(nuevo);
    return nuevo;
  },

  async actualizar(id, datos) {
    const empleado = await this.obtener(id);
    if (!empleado) return null;
    return Object.assign(empleado, datos);
  },

  async eliminar(id) {
    const antes = empleados.length;
    empleados = empleados.filter((e) => e.id !== String(id));
    return empleados.length < antes;
  }
};
