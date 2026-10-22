# Data model

Moved to osrs-tracker-api's [DATA-MODEL.md](https://github.com/osrs-tracker/osrs-tracker-api/blob/main/DATA-MODEL.md)
(osrs-tracker/osrs-tracker-api#205): no Lambda here writes MongoDB any more, and the ingester there applies the scrape
results and runs the item and clean-up jobs. It also covers the `osrs-tracker_subscriptions` table queue-players reads
and the pause/resume contract.

A change here to a scrape result message or to how queue-players reads the table needs an issue in osrs-tracker-api to
match it there.
