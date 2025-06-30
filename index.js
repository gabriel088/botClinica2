const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

const port = process.env.PORT || 3000;

const db = new sqlite3.Database('./clinica.db', (err) => {
  if (err) console.error("Error DB:", err.message);
  else console.log("🩺 Conectado a clinica.db");
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

let estadoUsuario = {
  paso: null,
  especialidadElegida: null,
  turnosDisponibles: [],
  datosUsuario: {
    dni: null,
    nombre: null,
    mail: null,
    obraSocial: null,
    numeroAfiliado: null
  }
};

app.post('/mensaje', (req, res) => {
  const mensajeUsuario = req.body.mensaje.trim().toLowerCase();
  let respuestaBot = "";

  if (mensajeUsuario.includes("hola")) {
    respuestaBot = `Elija colocando el número de la opción que desea.\n¿En qué área necesitás un turno?\n1. Oftalmología 👁️\n2. Pediatría 👶\n3. Odontología 🦷`;
    estadoUsuario = {
      paso: "esperandoEspecialidad",
      especialidadElegida: null,
      turnosDisponibles: [],
      datosUsuario: {
        dni: null,
        nombre: null,
        mail: null,
        obraSocial: null,
        numeroAfiliado: null
      }
    };
    return res.json({ respuesta: respuestaBot });
  }

  if (estadoUsuario.paso === "esperandoEspecialidad") {
    switch (mensajeUsuario) {
      case "1": estadoUsuario.especialidadElegida = "Oftalmología"; break;
      case "2": estadoUsuario.especialidadElegida = "Pediatría"; break;
      case "3": estadoUsuario.especialidadElegida = "Odontología"; break;
      default:
        return res.json({ respuesta: "Por favor, respondé con 1, 2 o 3." });
    }

    estadoUsuario.paso = "esperandoDNI";
    return res.json({ respuesta: `Seleccionaste ${estadoUsuario.especialidadElegida}.\nAhora decime tu DNI 📄:` });
  }

  if (estadoUsuario.paso === "esperandoDNI") {
    estadoUsuario.datosUsuario.dni = mensajeUsuario;
    estadoUsuario.paso = "esperandoNombre";
    return res.json({ respuesta: "Gracias. Ahora decime tu nombre completo 🧑:" });
  }

  if (estadoUsuario.paso === "esperandoNombre") {
    estadoUsuario.datosUsuario.nombre = mensajeUsuario;
    estadoUsuario.paso = "esperandoObraSocial";
    return res.json({ respuesta: "¿Cuál es tu obra social? 🏥" });
  }

  if (estadoUsuario.paso === "esperandoObraSocial") {
    estadoUsuario.datosUsuario.obraSocial = mensajeUsuario;
    estadoUsuario.paso = "esperandoNumeroAfiliado";
    return res.json({ respuesta: "Número de afiliado 🔢:" });
  }

  if (estadoUsuario.paso === "esperandoNumeroAfiliado") {
    estadoUsuario.datosUsuario.numeroAfiliado = mensajeUsuario;
    estadoUsuario.paso = "esperandoMail";
    return res.json({ respuesta: "Por favor, ingresá tu correo electrónico 📧:" });
  }

  if (estadoUsuario.paso === "esperandoMail") {
    estadoUsuario.datosUsuario.mail = mensajeUsuario;
    const d = estadoUsuario.datosUsuario;
    const especialidad = estadoUsuario.especialidadElegida;

    const query = `
      INSERT INTO turnos_cliente (nombre, dni, mail, obra_social, numero_afiliado, especialidad, fecha_asignada)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [
      d.nombre, d.dni, d.mail, d.obraSocial, d.numeroAfiliado, especialidad, ''
    ], function (err) {
      if (err) {
        console.error("❌ Error al guardar turno:", err.message);
        return res.json({ respuesta: "Hubo un error al guardar tus datos." });
      }

      db.all(
        `SELECT id, fecha, hora FROM turnos_libres WHERE especialidad = ? AND estado = 'disponible' ORDER BY fecha, hora LIMIT 5`,
        [especialidad],
        (err, filas) => {
          if (err) {
            console.error("❌ Error al obtener turnos libres:", err.message);
            return res.json({ respuesta: "Guardamos tus datos, pero no pudimos cargar los turnos." });
          }

          
          
if (filas.length === 0) {
  // Guardar en lista_espera
  const fechaSolicitud = new Date().toISOString();


  
  const insertListaEspera = `
    INSERT INTO lista_espera (nombre, dni, mail, obra_social, numero_afiliado, especialidad, fecha_solicitud)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(insertListaEspera, [
    d.nombre,
    d.dni,
    d.mail,
    d.obraSocial,
    d.numeroAfiliado,
    especialidad,
    fechaSolicitud
  ], function (err2) {
    if (err2) {
      console.error("❌ Error al guardar en lista_espera:", err2.message);
    }
  });

  estadoUsuario.paso = null;
  return res.json({
    respuesta: `Guardamos tus datos, pero NO hay turnos disponibles ahora. Te agregamos a la lista de espera. Te avisaremos por correo.`
  });
}




          estadoUsuario.turnosDisponibles = filas;
          estadoUsuario.paso = "esperandoSeleccionTurno";

          let opciones = filas.map((fila, i) => `${i + 1}. ${fila.fecha} a las ${fila.hora}`).join("\n");

          return res.json({
            respuesta: `Gracias por tus datos. Estos son los próximos turnos disponibles para ${especialidad}:\n\n${opciones}\n\nRespondé con el número del turno que querés.`
          });
        }
      );
    });
  }

  else if (estadoUsuario.paso === "esperandoSeleccionTurno") {
    const seleccion = parseInt(mensajeUsuario);
    const turnoSeleccionado = estadoUsuario.turnosDisponibles[seleccion - 1];

    if (!turnoSeleccionado) {
      return res.json({ respuesta: "Seleccioná un número válido de la lista de turnos." });
    }

    db.run(
      `UPDATE turnos_libres SET estado = 'asignado' WHERE id = ?`,
      [turnoSeleccionado.id],
      (err) => {
        if (err) {
          console.error("❌ Error al asignar turno:", err.message);
          return res.json({ respuesta: "Hubo un problema al asignar tu turno. Intentalo luego." });
        }

        db.run(
          `UPDATE turnos_cliente SET fecha_asignada = ? WHERE dni = ? AND especialidad = ?`,
          [`${turnoSeleccionado.fecha} ${turnoSeleccionado.hora}`, estadoUsuario.datosUsuario.dni, estadoUsuario.especialidadElegida],
          (err2) => {
            if (err2) {
              console.error("⚠️ Error al actualizar fecha_asignada:", err2.message);
            }
          }
        );

        estadoUsuario.paso = null;
        return res.json({
          respuesta: `✅ ¡Listo! Te asignamos el turno para el ${turnoSeleccionado.fecha} a las ${turnoSeleccionado.hora}. Te esperamos.`,
          redirigir: true
        });
      }
    );
  }

  else {
    return res.json({ respuesta: "No entendí. Escribí 'hola' para comenzar." });
  }
});

// Endpoints para turnos
app.get('/api/turnos_libres', (req, res) => {
  db.all(`SELECT * FROM turnos_libres ORDER BY fecha, hora`, (err, filas) => {
    if (err) return res.status(500).json({ error: "Error al obtener turnos libres" });
    res.json(filas);
  });
});

app.post('/api/turnos_libres', (req, res) => {
  const { especialidad, fecha, hora, estado } = req.body;
  const query = `INSERT INTO turnos_libres (especialidad, fecha, hora, estado) VALUES (?, ?, ?, ?)`;
  db.run(query, [especialidad, fecha, hora, estado], function (err) {
    if (err) return res.json({ success: false });
    res.json({ success: true, id: this.lastID });
  });
});

app.post('/api/borrar-turno', (req, res) => {
  const { id } = req.body;
  db.run(`DELETE FROM turnos_libres WHERE id = ?`, [id], function (err) {
    if (err) return res.json({ success: false });
    res.json({ success: true });
  });
});

app.post('/api/actualizar-turno', (req, res) => {
  const { id, especialidad, fecha, hora } = req.body;
  const query = `
    UPDATE turnos_libres
    SET especialidad = ?, fecha = ?, hora = ?
    WHERE id = ?
  `;
  db.run(query, [especialidad, fecha, hora, id], function (err) {
    if (err) {
      console.error("❌ Error al actualizar turno:", err.message);
      return res.json({ success: false });
    }
    res.json({ success: true });
  });
});

// 📌 NUEVOS ENDPOINTS para consultas
app.get('/api/consultas', (req, res) => {
  db.all(`SELECT * FROM consultas ORDER BY fecha DESC`, (err, filas) => {
    if (err) return res.status(500).json({ mensaje: "Error al cargar consultas" });
    res.json(filas);
  });
});

app.post('/api/consultas', (req, res) => {
  const { paciente, motivo } = req.body;
  const fecha = new Date().toISOString();

  const query = `INSERT INTO consultas (paciente, motivo, fecha) VALUES (?, ?, ?)`;
  db.run(query, [paciente, motivo, fecha], function (err) {
    if (err) {
      console.error("❌ Error al guardar consulta:", err.message);
      return res.status(500).json({ mensaje: "No se pudo guardar la consulta." });
    }
    res.json({ success: true });
  });
});

app.post('/api/consultas/borrar', (req, res) => {
  const { id } = req.body;
  db.run(`DELETE FROM consultas WHERE id = ?`, [id], function (err) {
    if (err) {
      console.error("❌ Error al borrar consulta:", err.message);
      return res.status(500).json({ mensaje: "No se pudo borrar la consulta." });
    }
    res.json({ success: true });
  });
});


app.get('/api/lista_espera', (req, res) => {
  db.all(`SELECT * FROM lista_espera ORDER BY fecha_solicitud DESC`, (err, filas) => {
    if (err) {
      console.error("❌ Error al obtener lista de espera:", err.message);
      return res.status(500).json({ mensaje: "Error al cargar la lista de espera" });
    }
    res.json(filas);
  });
});








app.listen(port, () => {
  console.log(`🚑 Servidor corriendo en http://localhost:${port}`);
});


