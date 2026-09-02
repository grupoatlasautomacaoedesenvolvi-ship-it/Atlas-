import Dexie, { Table } from 'dexie';
import { PeriodoAcumulado, DecisaoNotaOmissa } from '../types';

export interface EmpresaOmissa {
  cnpj: string;
  nome: string;
  uf: string;
  regime: string;
}

export class AtlasDB extends Dexie {
  periodos!: Table<PeriodoAcumulado, string>;
  decisoes!: Table<DecisaoNotaOmissa, string>;
  empresasOmissas!: Table<EmpresaOmissa, string>;

  constructor() {
    super('AtlasDB');
    this.version(1).stores({
      periodos: 'id',
      decisoes: 'chvNfe'
    });
    this.version(2).stores({
      periodos: 'id',
      decisoes: 'chvNfe',
      empresasOmissas: 'cnpj'
    });
  }
}

export const db = new AtlasDB();

