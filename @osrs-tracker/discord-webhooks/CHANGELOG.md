## v0.1.0 - 2026/10/02

- Replaced the `discord.js` dependency with the types-only `discord-api-types`. `DiscordWebhookMessage` is now
  `RESTPostAPIWebhookWithTokenJSONBody` (the Discord execute-webhook body), which drops the heavy `discord.js` install
  and its broken typings on newer `@types/node`.
- Updated `typescript` to `^5.9.3`.

## v0.0.2 - 2023/08/19

- Fix README.md shields and update `typescript` to `^5.1.6`.

## v0.0.1 - 2023/08/19

- Initial release
