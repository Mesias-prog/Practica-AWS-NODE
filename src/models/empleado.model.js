const { Schema, model } = require('mongoose');

const empleadoSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    cargo: { type: String, required: true, trim: true },
    salario: { type: Number, default: 0, min: 0 }
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret._id;
        return ret;
      }
    }
  }
);

module.exports = model('Empleado', empleadoSchema, 'empleados');
