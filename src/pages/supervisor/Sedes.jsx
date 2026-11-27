// src/pages/supervisor/Sedes.jsx
import React, { useState } from "react";
import { toast } from "react-toastify";
import Modal from "../../widgets/Modal";
import ConfirmDialog from "../../widgets/ConfirmDialog";
import FormField, { inputClass } from "../../widgets/FormField";
import { apiPost, apiPut, apiDelete } from "../../services/api.client";
export default function Sedes({ sedes, onChange }) {
  const [visible, setVisible] = useState(false),
    [form, setForm] = useState(null),
    [eliminar, setEliminar] = useState(null),
    [busy, setBusy] = useState(false),
    [errores, setErrores] = useState({});
  const edit = (s) => {
    setErrores({});
    setForm(s ? { ...s } : { nombre: "", direccion: "", activa: true });
  };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrores({});
    try {
      if (form.id) await apiPut(`/api/admin/sedes/${form.id}`, form);
      else await apiPost("/api/admin/sedes", form);
      toast.success("Sede guardada.");
      setForm(null);
      await onChange();
    } catch (ex) {
      setErrores(ex.errores || {});
      toast.error(ex.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await apiDelete(`/api/admin/sedes/${eliminar.id}`);
      toast.success("Sede eliminada.");
      await onChange();
    } catch (ex) {
      toast.error(ex.message);
    } finally {
      setEliminar(null);
    }
  };
  return (
    <section className="mb-3">
      <button
        className="btn btn-outline-primary btn-sm"
        type="button"
        onClick={() => setVisible(!visible)}
      >
        {visible ? "Ocultar sedes" : "Gestionar sedes"}
      </button>
      {visible && (
        <div className="card p-3 mt-2">
          <div className="d-flex justify-content-between mb-2">
            <h2 className="h5">Sedes</h2>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => edit(null)}
            >
              Nueva sede
            </button>
          </div>
          {!sedes.length ? (
            <p>No hay sedes registradas.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Dirección</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sedes.map((s) => (
                    <tr key={s.id}>
                      <td>{s.nombre}</td>
                      <td>{s.direccion}</td>
                      <td>{s.activa ? "Activa" : "Inactiva"}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-link"
                          onClick={() => edit(s)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-danger"
                          onClick={() => setEliminar(s)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <Modal
        show={!!form}
        title={form?.id ? "Editar sede" : "Nueva sede"}
        onClose={() => !busy && setForm(null)}
      >
        {form && (
          <form onSubmit={save}>
            <FormField id="sedeNombre" label="Nombre" error={errores.nombre}>
              <input
                id="sedeNombre"
                className={inputClass(errores.nombre)}
                required
                maxLength={60}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </FormField>
            <FormField
              id="sedeDireccion"
              label="Dirección"
              error={errores.direccion}
            >
              <input
                id="sedeDireccion"
                className={inputClass(errores.direccion)}
                maxLength={120}
                value={form.direccion}
                onChange={(e) =>
                  setForm({ ...form, direccion: e.target.value })
                }
              />
            </FormField>
            <label className="form-check mb-3">
              <input
                type="checkbox"
                className="form-check-input"
                checked={form.activa}
                onChange={(e) => setForm({ ...form, activa: e.target.checked })}
              />
              Sede activa
            </label>
            <button className="btn btn-primary" disabled={busy}>
              Guardar sede
            </button>
          </form>
        )}
      </Modal>
      <ConfirmDialog
        show={!!eliminar}
        title="¿Eliminar sede?"
        message="Solo se puede eliminar una sede sin ambientes asociados."
        confirmLabel="Eliminar"
        onConfirm={remove}
        onCancel={() => setEliminar(null)}
      />
    </section>
  );
}
