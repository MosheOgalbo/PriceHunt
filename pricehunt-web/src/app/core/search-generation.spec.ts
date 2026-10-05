import { isCurrentSearch } from './search-generation';

describe('isCurrentSearch', () => {
  it('drops a late event captured by a previous search', () => {
    expect(isCurrentSearch(1, 2)).toBeFalse();
  });

  it('keeps an event from the search that is on screen', () => {
    expect(isCurrentSearch(3, 3)).toBeTrue();
  });
});
