-- db/migrations/20261127220000_indices_integridad.sql
-- migrate:up
CREATE INDEX idx_asignaciones_asignado_por_id ON asignaciones(asignado_por_id);
CREATE INDEX idx_asignaciones_tecnico_id ON asignaciones(tecnico_id);
CREATE INDEX idx_bitacora_entradas_autor_id ON bitacora_entradas(autor_id);
CREATE INDEX idx_cambios_prioridad_anterior ON cambios_prioridad(anterior);
CREATE INDEX idx_cambios_prioridad_autor_id ON cambios_prioridad(autor_id);
CREATE INDEX idx_cambios_prioridad_nueva ON cambios_prioridad(nueva);
CREATE INDEX idx_categorias_prioridad_defecto ON categorias(prioridad_defecto);
CREATE INDEX idx_historial_estados_autor_id ON historial_estados(autor_id);
CREATE INDEX idx_historial_estados_estado_anterior ON historial_estados(estado_anterior);
CREATE INDEX idx_historial_estados_estado_nuevo ON historial_estados(estado_nuevo);
CREATE INDEX idx_reaperturas_autor_id ON reaperturas(autor_id);
CREATE INDEX idx_tickets_categoria_id ON tickets(categoria_id);
CREATE INDEX idx_tickets_prioridad ON tickets(prioridad);
CREATE INDEX idx_tickets_prioridad_sugerida ON tickets(prioridad_sugerida);
ALTER TABLE categorias
    ADD CONSTRAINT categorias_id_parent_unique
    UNIQUE(id,parent_id);
ALTER TABLE tickets
    ADD CONSTRAINT tickets_subcategoria_padre_fk
    FOREIGN KEY(subcategoria_id,categoria_id)
    REFERENCES categorias(id,parent_id)
    ON DELETE RESTRICT;
-- migrate:down
ALTER TABLE tickets DROP CONSTRAINT tickets_subcategoria_padre_fk;
ALTER TABLE categorias DROP CONSTRAINT categorias_id_parent_unique;
DROP INDEX idx_asignaciones_asignado_por_id;
DROP INDEX idx_asignaciones_tecnico_id;
DROP INDEX idx_bitacora_entradas_autor_id;
DROP INDEX idx_cambios_prioridad_anterior;
DROP INDEX idx_cambios_prioridad_autor_id;
DROP INDEX idx_cambios_prioridad_nueva;
DROP INDEX idx_categorias_prioridad_defecto;
DROP INDEX idx_historial_estados_autor_id;
DROP INDEX idx_historial_estados_estado_anterior;
DROP INDEX idx_historial_estados_estado_nuevo;
DROP INDEX idx_reaperturas_autor_id;
DROP INDEX idx_tickets_categoria_id;
DROP INDEX idx_tickets_prioridad;
DROP INDEX idx_tickets_prioridad_sugerida;
