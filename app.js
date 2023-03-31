require('dotenv').config();
const fs = require('fs');

const { consultaDB } = require('./helpers/db');

const tamNombre = 70;

const carrera = process.argv[2] || '502';
const plan = 2023;

const gruposMatriz = async () => {
  const sql = `
    SELECT mt.carrera, mt.plan, gr.grupo_equiv
    FROM sga_eqdef_matrices mt
    INNER JOIN sga_eqdef_grupos gr on (mt.matriz_equiv=gr.matriz_equiv)
    WHERE mt.carrera=?
    AND mt.plan=?
    ORDER BY gr.grupo_equiv;
  `;

  const params = [carrera, plan];

  try {
    const result = await consultaDB(sql, params);
    return result.rows;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const materiasGrupo = async (grupo, tipo) => {
  const sql = `
    SELECT mg.materia, m.nombre, mg.condicion, mg.temas_a_rendir
    FROM sga_eqdef_materias mg
    INNER JOIN sga_materias m on (mg.materia=m.materia)
    WHERE grupo_equiv=?
    AND origen_destino=?
    `;

  const params = [grupo, tipo];

  try {
    const result = await consultaDB(sql, params);
    return result.rows;
  } catch (error) {
    console.log(error);
    return [];
  }
};

const matriz = async () => {
  let salida = `Carrera: ${carrera} \t\t\nMaterias origen\tMaterias destino\tTemas a rendir\n`;

  const grupos = await gruposMatriz();
  for (const grupo of grupos) {
    let renglon = '';
    const materiasOrigen = await materiasGrupo(grupo.grupo_equiv, 'O');
    const materiasDestino = await materiasGrupo(grupo.grupo_equiv, 'D');
    // renglon += ` \n Grupo: ${grupo.grupo_equiv} \n`;
    renglon += ` \n-------------------------------- \n`;
    for (let i = 0; i < Math.max(materiasDestino.length, materiasOrigen.length); i++) {
      if (i < materiasOrigen.length) {
        const { materia, nombre, condicion, temas_a_rendir: temas } = materiasOrigen[i];
        renglon += formatoMateria(materia, nombre, condicion, temas);
      } else {
        renglon += formatoMateria('', '', '', '');
      }
      renglon += '\t';
      if (i < materiasDestino.length) {
        const { materia, nombre, condicion, temas_a_rendir: temas } = materiasDestino[i];
        renglon += formatoMateria(materia, nombre, condicion, `\t${temas ? temas : ''}`);
      } else {
        renglon += formatoMateria('', '', '', '');
      }
      renglon += '\n';
    }
    // console.log(renglon);
    // for (const materia of materiasOrigen) {
    //   console.log(formatoMateria(materia));
    // }
    salida += renglon;
  }
  fs.writeFileSync(`matriz-${carrera}.xls`, salida);
  console.log('OK.');
};

const formatoMateria = (materia, nombre, condicion, temas) => {
  // console.log(materia);
  const formato = !!materia ? `(${condicion}) ` + materia.padEnd(6, ' ') + nombre.padEnd(tamNombre + 20, ' ') : '';
  return formato.substring(0, tamNombre) + (!!temas ? temas : '');
};
matriz();
