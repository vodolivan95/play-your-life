import { createContext } from 'react';

/** Фото участников «Нашей жизни» по имени (аватары в шапке, сообщениях и комментариях). */
export const OurPhotos = createContext<Record<string, string>>({});

/** Похоже ли значение аватара на картинку (а не на смайлик). */
export const isImageSrc = (v: string) => /^(data:|https?:|blob:|\/|\.\/)|\.(webp|png|jpe?g|gif|svg|avif)(\?.*)?$/i.test(v);
