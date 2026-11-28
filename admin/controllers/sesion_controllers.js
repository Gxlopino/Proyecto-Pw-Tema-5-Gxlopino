// admin/controllers/sesion_controllers.js
export const endpoint =
  (service, status = 200) =>
  async (req, res) =>
    res
      .status(status)
      .json({
        success: true,
        message: "Operación realizada.",
        data: await service(req),
        error: null,
      });
export const saveSession = (req, user) =>
  new Promise((resolve, reject) =>
    req.session.regenerate((err) => {
      if (err) return reject(err);
      Object.assign(req.session, {
        userId: user.id,
        role: user.rol,
        username: user.email,
        version: user.sessionVersion,
      });
      req.session.save((err) => (err ? reject(err) : resolve()));
    }),
  );
export const destroySession = (req) =>
  new Promise((resolve, reject) =>
    req.session.destroy((err) => (err ? reject(err) : resolve())),
  );
