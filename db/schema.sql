-- db/schema.sql
-- Esquema de Tema 5 derivado de las migraciones dbmate; no incluye datos ni secretos.

CREATE TABLE prioridades(id serial PRIMARY KEY,codigo varchar(10) UNIQUE NOT NULL,nombre varchar(20) NOT NULL,orden integer UNIQUE NOT NULL CHECK(orden>0),color varchar(7) NOT NULL,horas integer NOT NULL CHECK(horas>0));
CREATE TABLE estados_ticket(id serial PRIMARY KEY,codigo varchar(15) UNIQUE NOT NULL,nombre varchar(30) NOT NULL,color varchar(7) NOT NULL,es_final boolean NOT NULL DEFAULT false);
CREATE TABLE unidades(id serial PRIMARY KEY,nombre varchar(100) UNIQUE NOT NULL);
CREATE TABLE sedes(id serial PRIMARY KEY,nombre varchar(60) UNIQUE NOT NULL,direccion varchar(120) NOT NULL DEFAULT '',activa boolean NOT NULL DEFAULT true);
CREATE TABLE ambientes(id serial PRIMARY KEY,sede_id integer NOT NULL REFERENCES sedes ON DELETE RESTRICT,codigo varchar(15) UNIQUE NOT NULL,tipo varchar(20) NOT NULL CHECK(tipo IN('aula','aula_magna','laboratorio','auditorio','biblioteca','otro')),nombre varchar(60) NOT NULL,pabellon varchar(30) NOT NULL,piso integer NOT NULL CHECK(piso>=0),capacidad integer NOT NULL CHECK(capacidad>0),activo boolean NOT NULL DEFAULT true);
CREATE TABLE categorias(id serial PRIMARY KEY,nombre varchar(60) NOT NULL,parent_id integer REFERENCES categorias ON DELETE RESTRICT,prioridad_defecto varchar(10) NOT NULL REFERENCES prioridades(codigo),tiempo_esperado_horas integer NOT NULL CHECK(tiempo_esperado_horas>0),descripcion varchar(240) NOT NULL DEFAULT '',activa boolean NOT NULL DEFAULT true,creada_en timestamptz NOT NULL DEFAULT now(),CHECK(parent_id IS DISTINCT FROM id));
CREATE UNIQUE INDEX categorias_nombre_nivel ON categorias(coalesce(parent_id,0),lower(nombre));
CREATE TABLE usuarios(id serial PRIMARY KEY,nombres varchar(60) NOT NULL,apellidos varchar(60) NOT NULL,email varchar(100) UNIQUE NOT NULL CHECK(email=lower(email)),password_hash varchar(100) NOT NULL,telefono varchar(15) NOT NULL,unidad_id integer REFERENCES unidades ON DELETE SET NULL,vinculo varchar(20) NOT NULL CHECK(vinculo IN('alumno','docente','administrativo','otro')),rol varchar(15) NOT NULL CHECK(rol IN('usuario','tecnico','supervisor')),estado varchar(15) NOT NULL DEFAULT 'activo' CHECK(estado IN('activo','inactivo','bloqueado')),motivo_bloqueo text,intentos_fallidos integer NOT NULL DEFAULT 0 CHECK(intentos_fallidos>=0),bloqueado_hasta timestamptz,ambiente_habitual_id integer REFERENCES ambientes ON DELETE SET NULL,creado_en timestamptz NOT NULL DEFAULT now(),ultimo_acceso timestamptz,session_version integer NOT NULL DEFAULT 1);
CREATE TABLE tecnicos_categorias(id serial PRIMARY KEY,tecnico_id integer NOT NULL REFERENCES usuarios ON DELETE CASCADE,categoria_id integer NOT NULL REFERENCES categorias ON DELETE CASCADE,habilitado_en timestamptz NOT NULL DEFAULT now(),UNIQUE(tecnico_id,categoria_id));
CREATE TABLE especialidades_declaradas(id serial PRIMARY KEY,usuario_id integer NOT NULL REFERENCES usuarios ON DELETE CASCADE,categoria_id integer NOT NULL REFERENCES categorias ON DELETE CASCADE,UNIQUE(usuario_id,categoria_id));
CREATE TABLE invitaciones(id serial PRIMARY KEY,nombres varchar(60) NOT NULL,apellidos varchar(60) NOT NULL,email varchar(100) NOT NULL,rol varchar(15) NOT NULL CHECK(rol IN('tecnico','supervisor')),token_hash varchar(64) UNIQUE NOT NULL,invitado_por_id integer NOT NULL REFERENCES usuarios ON DELETE RESTRICT,estado varchar(15) NOT NULL DEFAULT 'pendiente' CHECK(estado IN('pendiente','aceptada','rechazada','vencida')),creada_en timestamptz NOT NULL DEFAULT now(),vence_en timestamptz NOT NULL,aceptada_en timestamptz,CHECK(vence_en>creada_en));
CREATE UNIQUE INDEX invitaciones_pendientes_email ON invitaciones(lower(email)) WHERE estado='pendiente';
CREATE TABLE tokens_recuperacion(id serial PRIMARY KEY,usuario_id integer NOT NULL REFERENCES usuarios ON DELETE CASCADE,token_hash varchar(64) UNIQUE NOT NULL,creado_en timestamptz NOT NULL DEFAULT now(),vence_en timestamptz NOT NULL,usado_en timestamptz,CHECK(vence_en>creado_en));
CREATE SEQUENCE ticket_codigo_seq START 1000;
CREATE TABLE tickets(id serial PRIMARY KEY,codigo varchar(24) UNIQUE NOT NULL DEFAULT ('TCK-'||extract(year FROM now())::text||'-'||lpad(nextval('ticket_codigo_seq')::text,5,'0')),asunto varchar(120) NOT NULL,descripcion varchar(600) NOT NULL,categoria_id integer NOT NULL REFERENCES categorias ON DELETE RESTRICT,subcategoria_id integer NOT NULL REFERENCES categorias ON DELETE RESTRICT,ambiente_id integer NOT NULL REFERENCES ambientes ON DELETE RESTRICT,solicitante_id integer NOT NULL REFERENCES usuarios ON DELETE RESTRICT,tecnico_id integer REFERENCES usuarios ON DELETE RESTRICT,prioridad varchar(10) NOT NULL REFERENCES prioridades(codigo),prioridad_sugerida varchar(10) NOT NULL REFERENCES prioridades(codigo),estado varchar(15) NOT NULL REFERENCES estados_ticket(codigo),creado_en timestamptz NOT NULL DEFAULT now(),vence_en timestamptz NOT NULL,tiempo_espera_min integer NOT NULL DEFAULT 0 CHECK(tiempo_espera_min>=0));
CREATE TABLE tickets_cierres(id serial PRIMARY KEY,ticket_id integer UNIQUE NOT NULL REFERENCES tickets ON DELETE CASCADE,solucion text,resuelto_en timestamptz NOT NULL,cerrado_en timestamptz,tiempo_atencion_min integer CHECK(tiempo_atencion_min>=0));
CREATE TABLE esperas_ticket(id serial PRIMARY KEY,ticket_id integer NOT NULL REFERENCES tickets ON DELETE CASCADE,motivo text NOT NULL,fecha_retorno timestamptz NOT NULL,inicio_en timestamptz NOT NULL DEFAULT now(),fin_en timestamptz,CHECK(fin_en IS NULL OR fin_en>=inicio_en));
CREATE UNIQUE INDEX una_espera_activa ON esperas_ticket(ticket_id) WHERE fin_en IS NULL;
CREATE TABLE reaperturas(id serial PRIMARY KEY,ticket_id integer NOT NULL REFERENCES tickets ON DELETE CASCADE,autor_id integer NOT NULL REFERENCES usuarios ON DELETE RESTRICT,motivo text NOT NULL,creado_en timestamptz NOT NULL DEFAULT now());
CREATE TABLE bitacora_entradas(id serial PRIMARY KEY,ticket_id integer NOT NULL REFERENCES tickets ON DELETE CASCADE,autor_id integer NOT NULL REFERENCES usuarios ON DELETE RESTRICT,tipo varchar(10) NOT NULL CHECK(tipo IN('publico','interno')),texto varchar(600) NOT NULL CHECK(length(trim(texto))>0),creado_en timestamptz NOT NULL DEFAULT now());
CREATE TABLE historial_estados(id serial PRIMARY KEY,ticket_id integer NOT NULL REFERENCES tickets ON DELETE CASCADE,estado_anterior varchar(15) REFERENCES estados_ticket(codigo),estado_nuevo varchar(15) NOT NULL REFERENCES estados_ticket(codigo),autor_id integer NOT NULL REFERENCES usuarios ON DELETE RESTRICT,motivo text,permanencia_min integer NOT NULL DEFAULT 0 CHECK(permanencia_min>=0),creado_en timestamptz NOT NULL DEFAULT now());
CREATE TABLE asignaciones(id serial PRIMARY KEY,ticket_id integer NOT NULL REFERENCES tickets ON DELETE CASCADE,tecnico_id integer REFERENCES usuarios ON DELETE RESTRICT,asignado_por_id integer NOT NULL REFERENCES usuarios ON DELETE RESTRICT,tipo varchar(20) NOT NULL CHECK(tipo IN('asignacion','reasignacion','autoasignacion','devolucion')),motivo varchar(240),nota text,creado_en timestamptz NOT NULL DEFAULT now());
CREATE TABLE cambios_prioridad(id serial PRIMARY KEY,ticket_id integer NOT NULL REFERENCES tickets ON DELETE CASCADE,anterior varchar(10) NOT NULL REFERENCES prioridades(codigo),nueva varchar(10) NOT NULL REFERENCES prioridades(codigo),motivo varchar(240) NOT NULL,autor_id integer NOT NULL REFERENCES usuarios ON DELETE RESTRICT,creado_en timestamptz NOT NULL DEFAULT now());
CREATE TABLE sesiones(sid varchar PRIMARY KEY,sess json NOT NULL,expire timestamp(6) NOT NULL);
CREATE INDEX sesiones_expire ON sesiones(expire);
CREATE INDEX tickets_cola ON tickets(estado,prioridad,creado_en);
CREATE INDEX tickets_solicitante ON tickets(solicitante_id,creado_en);
CREATE INDEX tickets_tecnico ON tickets(tecnico_id,estado);
CREATE INDEX tickets_ambiente_categoria ON tickets(ambiente_id,categoria_id,estado);
CREATE INDEX tickets_subcategoria ON tickets(subcategoria_id);
CREATE INDEX categorias_parent ON categorias(parent_id);
CREATE INDEX ambientes_sede ON ambientes(sede_id);
CREATE INDEX tecnicos_categoria ON tecnicos_categorias(categoria_id);
CREATE INDEX especialidades_categoria ON especialidades_declaradas(categoria_id);
CREATE INDEX usuarios_unidad ON usuarios(unidad_id);
CREATE INDEX usuarios_ambiente ON usuarios(ambiente_habitual_id);
CREATE INDEX invitaciones_autor ON invitaciones(invitado_por_id);
CREATE INDEX recuperacion_usuario ON tokens_recuperacion(usuario_id);
CREATE INDEX cierres_fecha ON tickets_cierres(cerrado_en);
CREATE INDEX esperas_ticket_fecha ON esperas_ticket(ticket_id,inicio_en);
CREATE INDEX reaperturas_ticket ON reaperturas(ticket_id);
CREATE INDEX bitacora_ticket_fecha ON bitacora_entradas(ticket_id,creado_en);
CREATE INDEX historial_ticket_fecha ON historial_estados(ticket_id,creado_en);
CREATE INDEX asignaciones_ticket ON asignaciones(ticket_id,creado_en);
CREATE INDEX cambios_ticket ON cambios_prioridad(ticket_id,creado_en);
-- Solo Express accede con el rol PostgreSQL del servidor; no se publica el Data API.
DO $$ DECLARE t record; BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename); EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t.tablename); END LOOP; END $$;


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
ALTER TABLE categorias ADD CONSTRAINT categorias_id_parent_unique UNIQUE(id,parent_id);
ALTER TABLE tickets ADD CONSTRAINT tickets_subcategoria_padre_fk FOREIGN KEY(subcategoria_id,categoria_id) REFERENCES categorias(id,parent_id) ON DELETE RESTRICT;

