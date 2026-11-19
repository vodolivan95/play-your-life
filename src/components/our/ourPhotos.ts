import { createContext } from 'react';

/** Фото участников «Нашей жизни» по имени (аватары в шапке, сообщениях и комментариях). */
export const OurPhotos = createContext<Record<string, string>>({});
