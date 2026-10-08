use serde::{Deserialize, Serialize};

pub const ECONOMY_RULES_VERSION: u16 = 1;
pub const COMPLETION_BRIBE_TOKEN_AWARD: u32 = 1;
pub const FIRST_COMPLETION_DAILY_AWARD_LIMIT: u32 = 3;
pub const CASE_BRIBE_TOKEN_AWARD_LIMIT: u32 = 3;
pub const STATE_EXPLORER_TOKEN_AWARD: u32 = 2;
pub const NATIONAL_INVESTIGATOR_TOKEN_AWARD: u32 = 5;
pub const BRIBE_TOKEN_BALANCE_CAP: u32 = 20;
pub const WEEKLY_CHALLENGE_TOKEN_AWARD: u32 = 5;
pub const WEEKLY_CHALLENGE_AWARD_LIMIT: u32 = 1;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GameplayCurrency {
    CaseBudget,
    CareerPoints,
    EarnedBribeToken,
    ChallengeToken,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProductKind {
    Cosmetic,
    VisualTheme,
    CosmeticVehicle,
    CosmeticUniform,
    Animation,
    StoryPack,
    SupporterEdition,
    SponsoredCosmetic,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GameplayEffect {
    None,
    ClueAccuracy,
    WarrantValidity,
    PenaltyReduction,
    FasterCaseClock,
    TransportAdvantage,
    DossierAdvantage,
    CareerProgression,
    BribeTokens,
    ChallengeAdvantage,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct CommerceProductPolicy {
    pub product_id: String,
    pub kind: ProductKind,
    pub gameplay_effect: GameplayEffect,
    pub sponsorship_disclosed: bool,
}

impl CommerceProductPolicy {
    pub fn validate(&self) -> Result<(), String> {
        if self.product_id.trim().is_empty() {
            return Err("product_id is required".into());
        }
        if self.gameplay_effect != GameplayEffect::None {
            return Err("paid products cannot alter authoritative gameplay".into());
        }
        if self.kind == ProductKind::SponsoredCosmetic && !self.sponsorship_disclosed {
            return Err("sponsored products must be clearly disclosed".into());
        }
        Ok(())
    }
}

pub fn currency_can_be_purchased(currency: GameplayCurrency) -> bool {
    let _ = currency;
    false
}

pub fn completion_bribe_token_award(
    first_completion: bool,
    awards_today: u32,
    current_balance: u32,
) -> u32 {
    if !first_completion
        || awards_today >= FIRST_COMPLETION_DAILY_AWARD_LIMIT
        || current_balance >= BRIBE_TOKEN_BALANCE_CAP
    {
        return 0;
    }
    COMPLETION_BRIBE_TOKEN_AWARD.min(BRIBE_TOKEN_BALANCE_CAP - current_balance)
}

pub fn case_award_components(
    difficulty: u8,
    wrong_travels: u32,
    pressure_attempts: u32,
) -> Vec<String> {
    let mut result = vec!["first_completion".into()];
    if wrong_travels == 0 {
        result.push("clean_route".into());
    }
    if pressure_attempts == 0 {
        result.push("ethical_investigation".into());
    }
    if difficulty >= 4 {
        result.push("high_difficulty".into());
    }
    result
}

pub fn capped_case_award(potential: u32, earned_today: u32, current_balance: u32) -> u32 {
    potential
        .min(CASE_BRIBE_TOKEN_AWARD_LIMIT)
        .min(FIRST_COMPLETION_DAILY_AWARD_LIMIT.saturating_sub(earned_today))
        .min(BRIBE_TOKEN_BALANCE_CAP.saturating_sub(current_balance))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_gameplay_currency_is_purchasable() {
        for currency in [
            GameplayCurrency::CaseBudget,
            GameplayCurrency::CareerPoints,
            GameplayCurrency::EarnedBribeToken,
            GameplayCurrency::ChallengeToken,
        ] {
            assert!(!currency_can_be_purchased(currency));
        }
    }

    #[test]
    fn rejects_every_pay_to_win_effect() {
        for gameplay_effect in [
            GameplayEffect::ClueAccuracy,
            GameplayEffect::WarrantValidity,
            GameplayEffect::PenaltyReduction,
            GameplayEffect::FasterCaseClock,
            GameplayEffect::TransportAdvantage,
            GameplayEffect::DossierAdvantage,
            GameplayEffect::CareerProgression,
            GameplayEffect::BribeTokens,
            GameplayEffect::ChallengeAdvantage,
        ] {
            let product = CommerceProductPolicy {
                product_id: "forbidden".into(),
                kind: ProductKind::Cosmetic,
                gameplay_effect,
                sponsorship_disclosed: true,
            };
            assert!(product.validate().is_err());
        }
    }

    #[test]
    fn allows_disclosed_presentation_and_story_products_only() {
        for kind in [
            ProductKind::Cosmetic,
            ProductKind::VisualTheme,
            ProductKind::CosmeticVehicle,
            ProductKind::CosmeticUniform,
            ProductKind::Animation,
            ProductKind::StoryPack,
            ProductKind::SupporterEdition,
            ProductKind::SponsoredCosmetic,
        ] {
            let product = CommerceProductPolicy {
                product_id: "safe-product".into(),
                kind,
                gameplay_effect: GameplayEffect::None,
                sponsorship_disclosed: true,
            };
            assert_eq!(product.validate(), Ok(()));
        }
    }

    #[test]
    fn completion_awards_are_capped_and_cannot_be_replay_farmed() {
        assert_eq!(completion_bribe_token_award(true, 0, 0), 1);
        assert_eq!(completion_bribe_token_award(false, 0, 0), 0);
        assert_eq!(completion_bribe_token_award(true, 3, 0), 0);
        assert_eq!(completion_bribe_token_award(true, 0, 20), 0);
    }
    #[test]
    fn actions_map_to_transparent_components_and_caps() {
        assert_eq!(
            case_award_components(5, 0, 0),
            vec![
                "first_completion",
                "clean_route",
                "ethical_investigation",
                "high_difficulty"
            ]
        );
        assert_eq!(case_award_components(2, 1, 1), vec!["first_completion"]);
        assert_eq!(capped_case_award(4, 0, 0), 3);
        assert_eq!(capped_case_award(3, 2, 0), 1);
        assert_eq!(capped_case_award(3, 0, 19), 1);
        assert_eq!(capped_case_award(3, 3, 0), 0);
    }
}
