/* eslint-disable @typescript-eslint/no-explicit-any */
/* PLAY YOUR LIFE 2.0 — единая точка доступа «Нашей жизни» к данным: облако Firestore
 * или локальное хранилище этого браузера (демо-режим, пока правила не опубликованы). */
import * as cloud from 'firebase/firestore';
import * as local from './localFirestore.ts';

let demo = false;
export const isDemo = () => demo;
export function enableDemo() { demo = true; return local.localDb as unknown as cloud.Firestore; }

const pick = <K extends keyof typeof local & keyof typeof cloud>(k: K) => ((...a: any[]) => ((demo ? local[k] : cloud[k]) as any)(...a)) as unknown as (typeof cloud)[K];
export const collection = pick('collection');
export const doc = pick('doc');
export const query = pick('query');
export const where = pick('where');
export const orderBy = pick('orderBy');
export const limit = pick('limit');
export const onSnapshot = pick('onSnapshot');
export const setDoc = pick('setDoc');
export const updateDoc = pick('updateDoc');
export const deleteDoc = pick('deleteDoc');
export const getDoc = pick('getDoc');
export const runTransaction = pick('runTransaction');
export const increment = pick('increment');
export const arrayUnion = pick('arrayUnion');
export const serverTimestamp = pick('serverTimestamp');
