-- Anonymous, append-only measurements. No account, cookie, IP or user-agent columns.
CREATE TABLE IF NOT EXISTS ad_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  campaign_id BIGINT UNSIGNED NOT NULL,
  creative_id BIGINT UNSIGNED NOT NULL,
  placement_id VARCHAR(80) NOT NULL,
  kind ENUM('impression','click','visit') NOT NULL,
  source ENUM('scene_3d','scene_2d','details') NOT NULL,
  occurred_at BIGINT NOT NULL COMMENT 'Server UTC Unix milliseconds',
  INDEX ad_event_time (occurred_at, id),
  INDEX ad_event_campaign (campaign_id, occurred_at, id),
  FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id),
  FOREIGN KEY (creative_id) REFERENCES ad_creatives(id),
  FOREIGN KEY (placement_id) REFERENCES ad_placements(id)
);
