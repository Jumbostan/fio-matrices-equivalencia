require('dotenv').config();
const fs = require('fs');
const cliProgress = require('cli-progress');
const { consultaDB } = require('./helpers/db');

let alumnosTotal = 'Carrera\tPlan\tLegajo\tAlumno\n';
let alumnosAdeudan = 'Carrera\tPlan\tLegajo\tAlumno\tCantidad\n';
let alumnosMaterias = 'Carrera\tPlan\tLegajo\tAlumno\tMateria\n';

//alumnos reinscriptos que no esten en el plan 2023
const buscarAlumnos = async () => {
  const sql = `
    SELECT al.carrera, al.legajo, p.apellido, p.nombres, al.plan, pl.version_actual
    FROM sga_alumnos al
    INNER JOIN sga_reinscripcion re on (al.carrera=re.carrera and al.legajo=re.legajo)
    INNER JOIN sga_personas p on (al.nro_inscripcion=p.nro_inscripcion)
    INNER JOIN sga_planes pl on (al.carrera=pl.carrera and al.plan=pl.plan)
    WHERE al.carrera in(502,507,509,514,516,525)
    AND al.plan<>2023
    AND al.calidad='A'
    AND re.anio_academico=2023
    ORDER BY  p.apellido, p.nombres, al.carrera
`;

  const params = [];

  try {
    const result = await consultaDB(sql, params);
    return result.rows;
  } catch (error) {
    console.log(error);
    return [];
  }
};

//lista de materias de 1er año que adeuda un alumno por carrera
const materiasAdeuda1er = async (carrera, legajo, plan, version) => {
  const sql = `
    SELECT materia, nombre_materia
    FROM sga_atrib_mat_plan
    WHERE carrera=?
    and plan=?
    and version=?
    and anio_de_cursada=1
    and materia not in (select materia
        from sga_cursadas
        where legajo=?
        and carrera=?
        and resultado='A'
        and fin_vigencia_regul>TODAY)
    and materia not in (
    select materia
    from vw_hist_academica
    where legajo=?
    and carrera=?
    and resultado='A')
`;

  const params = [carrera, plan, version, legajo, carrera, legajo, carrera];

  try {
    const result = await consultaDB(sql, params);
    return result.rows;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const procesar = async () => {
  const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

  const alumnos = await buscarAlumnos();

  bar1.start(alumnos.length, 0);

  for (const [index, alumno] of alumnos.entries()) {
    bar1.update(index);

    // if (index > 100) break;

    const { carrera, legajo, apellido, nombres, plan, version_actual } = alumno;
    const materias = await materiasAdeuda1er(carrera, legajo, plan, version_actual);
    alumnosTotal += `${carrera}\t${plan}\t${legajo}\t${apellido}, ${nombres}\n`;
    if (materias.length > 0) {
      alumnosAdeudan += `${carrera}\t${plan}\t${legajo}\t${apellido}, ${nombres}\t${materias.length}\n`;
      for (const { materia, nombre_materia } of materias) {
        alumnosMaterias += `${carrera}\t${plan}\t${legajo}\t${apellido}, ${nombres}\t${materia}\n`;
      }
    }
    // console.log(apellido, mat.length);
  }

  bar1.stop();
  // console.log(mat);
  fs.writeFileSync(`alumnos-reinscriptos.xls`, alumnosTotal);
  fs.writeFileSync(`alumnos-adeudan.xls`, alumnosAdeudan);
  fs.writeFileSync(`alumnos-materias-adeudan.xls`, alumnosMaterias);
};

procesar();
