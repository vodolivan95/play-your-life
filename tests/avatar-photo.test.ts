import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import { validateState } from '../src/stateValidation.ts';

const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/';

test('своё фото в профиле проходит проверку сохранения', () => {
  const state = initialState();
  const withPhoto = { ...state, profile: { ...state.profile, photo: tiny } };
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(withPhoto))));
  assert.doesNotThrow(() => validateState(JSON.parse(JSON.stringify(state))));
});

test('чужой формат, ссылка или слишком большое фото отклоняются', () => {
  const state = initialState();
  for (const photo of ['https://example.com/a.jpg', 'data:text/html;base64,PGI+', 'data:image/jpeg;base64,' + 'A'.repeat(170000), 5]) {
    const broken = { ...state, profile: { ...state.profile, photo } };
    assert.throws(() => validateState(JSON.parse(JSON.stringify(broken))), /повреждённые/);
  }
});
