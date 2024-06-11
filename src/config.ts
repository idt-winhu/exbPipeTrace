import { ImmutableObject } from 'seamless-immutable';

export interface Config {
  uploadProgURL: string;  
  saveFilePath: string;  
}

export type IMConfig = ImmutableObject<Config>;
