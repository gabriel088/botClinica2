document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/turnos')
    .then(res => res.json())
    .then(turnos => {
      const tbody = document.querySelector('#tabla-turnos tbody');
      tbody.innerHTML = '';

      turnos.forEach(turno => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${turno.id}</td>
          <td>${turno.nombre}</td>
          <td>${turno.dni}</td>
          <td>${turno.obra_social}</td>
          <td>${turno.especialidad}</td>
          <td>${turno.turno}</td>
          <td>${turno.fecha_turno}</td>
          <td>${turno.hora_turno || ''}</td>
          <td>
            <input type="time" id="hora-${turno.id}">
            <button onclick="asignarHora(${turno.id})">Asignar</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    });
});

function asignarHora(id) {
  const horaInput = document.getElementById(`hora-${id}`);
  const hora = horaInput.value;

  if (!hora) {
    alert('Ingresá una hora válida');
    return;
  }

  fetch('/api/asignar-hora', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, hora_turno: hora })
  })
    .then(res => res.json())
    .then(respuesta => {
      if (respuesta.success) {
        alert('Hora asignada con éxito');
        location.reload();
      } else {
        alert('Error al asignar la hora');
      }
    });
}
