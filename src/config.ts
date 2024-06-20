import { ImmutableObject } from 'seamless-immutable';

export interface Config {  
  serverProgRootURL: string;  
}

export type IMConfig = ImmutableObject<Config>;
