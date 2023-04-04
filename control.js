require('dotenv').config();
const fs = require('fs');
const cliProgress = require('cli-progress');
const { consultaDB } = require('./helpers/db');

const defMatrizEquiv = {
  502: [
    { anterior: 'X5.2', actual: '1001' },
    { anterior: 'X8.0', actual: '7020' },
    { anterior: 'X10.2', actual: '7013' },
  ],
  507: [
    { anterior: 'X5.1', actual: '2030' },
    { anterior: 'X5.1', actual: '1001' },
    { anterior: 'X8.0', actual: '7020' },
    { anterior: 'X10.1', actual: '7012' },
  ],
  509: [
    { anterior: 'X5.4', actual: '5001' },
    { anterior: 'X5.4', actual: '1001' },
    { anterior: 'X8.0', actual: '7025' },
    { anterior: 'X10.4', actual: '7015' },
  ],
  514: [
    { anterior: 'X5.3', actual: '4001' },
    { anterior: 'X5.3', actual: '1001' },
    { anterior: 'X8.0', actual: '7020' },
    { anterior: 'X10.3', actual: '7014' },
  ],
  516: [
    { anterior: 'X8.0', actual: '7020' },
    { anterior: 'X10.2', actual: '7013' },
  ],
  525: [
    { anterior: 'X5.5', actual: '2001' },
    { anterior: 'X5.5', actual: '1001' },
    { anterior: 'X8.0', actual: '7020' },
    { anterior: 'X10.5', actual: '7011' },
  ],
};

let nombresMaterias = [];
let matrizEquiv = [];
let equivFaltantes = [];

const obtenerNombresMaterias = async () => {
  const sql = `
  SELECT actividad as materia, nombre
  FROM sga_activ_extracur
  UNION
  SELECT distinct m.materia , m.nombre
  FROM sga_materias m
  INNER JOIN sga_atrib_mat_plan a on (a.materia=m.materia)
  WHERE a.plan=2023
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

//devuelve la lista de alumnos plan 2023 provenientes de un plan anterior
const alumnosCambiados = async () => {
  const sql = `
    SELECT carrera, legajo, plan
    FROM sga_cambios_plan
    WHERE ((carrera=502 AND plan=2004)
    OR (carrera=507 AND plan=2004) 
    OR (carrera=509 AND plan=2004) 
    OR (carrera=514 AND plan=2007) 
    OR (carrera=516 AND plan=2003) 
    OR (carrera=525 AND plan=2013))
    AND legajo||carrera  IN 
        (SELECT legajo||carrera  
        FROM sga_alumnos al
        WHERE al.plan=2023)
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

//devuelve la lista de actividades extracurriculares de un alumno en una carrera-plan
const actividadesAlumno = async (carrera, legajo, plan) => {
  const sql = `EXECUTE FUNCTION dba.sp_activ_extra_x_alum_fio2(?, ?)`;
  const params = ['FIO', legajo];

  try {
    const result = await consultaDB(sql, params);
    return result.rows.filter((act) => act.carrera === carrera && act.plan === plan);
  } catch (error) {
    console.log(error);
    return [];
  }
};

//devuelve la lista de materias aprobadas de un alumno en una carrera-plan
const historiaAcademica = async (carrera, legajo, plan) => {
  const sql = `
    SELECT m.materia, m.nombre
    FROM vw_hist_academica ha
    INNER JOIN sga_materias m ON(ha.materia=m.materia)
    WHERE carrera=?
    AND legajo=?
    AND plan=?
    AND resultado='A'
  `;
  const params = [carrera, legajo, plan];

  try {
    const result = await consultaDB(sql, params);
    return result.rows;
  } catch (error) {
    console.log(error);
    return [];
  }
};

//devuelve una lista unificada (materia, nombre) de todas las materias + las
//actividades extracurriculares de un alumno para una carrera con plan 2023
const materiasActividades2023 = async (carrera, legajo) => {
  //obtengo actividades y materias de una carrera plan 2023
  const actividades = await actividadesAlumno(carrera, legajo, '2023');
  const materias = await historiaAcademica(carrera, legajo, '2023');

  //normalizo a [{nombre, materia}] las actividades para devolver un unico array
  const actividadesNormalizadas = actividades.map((act) => ({
    materia: act.actividad,
    nombre: act.activ_extracur_nombre,
  }));

  return [...materias, ...actividadesNormalizadas];
};

const equivalencias = async (carrera, legajo, plan) => {
  const actividadesAnt = await actividadesAlumno(carrera, legajo, plan);
  const historiaActual = await materiasActividades2023(carrera, legajo);

  for (const { carrera, legajo, plan, actividad, activ_extracur_nombre } of actividadesAnt) {
    // const actAcual = defMatrizEquiv[carrera].find((act) => act.anterior === actividad)?.actual;
    const actActuales = defMatrizEquiv[carrera].filter((act) => act.anterior === actividad);

    if (!actActuales.length === 0) continue;
    for (const aa of actActuales) {
      const actAcual = aa.actual;
      const existeEquivalencia = historiaActual.find((ha) => ha.materia === actAcual);

      const nomActActual = nombresMaterias.find((m) => m.materia === actAcual).nombre;
      // console.log(existeEquivalencia);
      const OK = !!existeEquivalencia ? 'OK' : '';
      // console.log(carrera, legajo, actividad, activ_extracur_nombre, actAcual, nomActActual, OK);

      if (!existeEquivalencia) {
        const equivFaltante = `${carrera}\t${legajo.padEnd(
          8,
          ' '
        )}\t(${actividad}) ${activ_extracur_nombre} => (${actAcual}) ${nomActActual}\n`;
        equivFaltantes.push(equivFaltante);
      }

      const strEquiv = `${carrera} (${actividad}) ${activ_extracur_nombre} => (${actAcual}) ${nomActActual}`;
      if (!matrizEquiv.includes(strEquiv)) {
        matrizEquiv.push(strEquiv);
      }
    }
  }
};

const generarSalida = () => {
  let salida = 'Carrera\tLegajo\tEquivalencia\n';
  for (const eq of matrizEquiv) {
    // console.log(eq);
  }
  for (const equivFaltante of equivFaltantes) {
    // console.log(equivFaltante);
    salida += equivFaltante;
  }
  fs.writeFileSync('equivalencias-faltantes.xls', salida);
};

const procesar = async () => {
  const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

  nombresMaterias = await obtenerNombresMaterias();
  const alumnos = await alumnosCambiados();
  console.log(alumnos.length);
  bar1.start(alumnos.length - 1, 0);

  for (const [i, { carrera, legajo, plan }] of alumnos.entries()) {
    bar1.update(i);

    // if (i > 10) continue;
    const actividades = await equivalencias(carrera, legajo, plan);
  }
  bar1.stop();

  generarSalida();
};

procesar();
