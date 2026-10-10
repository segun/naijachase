use chrono::{Datelike, NaiveDate, Utc};

#[derive(Clone, Copy, Debug)]
pub struct BirthDate(NaiveDate);

impl BirthDate {
    pub fn new(day: u32, month: u32, year: u32) -> Result<Self, &'static str> {
        Self::on(day, month, year, Utc::now().date_naive())
    }

    fn on(day: u32, month: u32, year: u32, today: NaiveDate) -> Result<Self, &'static str> {
        let date = i32::try_from(year)
            .ok()
            .filter(|year| (1000..=9999).contains(year))
            .and_then(|year| NaiveDate::from_ymd_opt(year, month, day))
            .ok_or("Enter a valid date of birth.")?;
        if date > today {
            return Err("Date of birth cannot be in the future.");
        }
        let birthday_passed = (today.month(), today.day()) >= (month, day);
        let age = today.year() - date.year() - i32::from(!birthday_passed);
        if age < 18 {
            return Err("You must be 18 years or older.");
        }
        Ok(Self(date))
    }

    pub(crate) fn database_value(self) -> String {
        self.0.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn birth_date_requires_eighteenth_birthday() {
        let today = NaiveDate::from_ymd_opt(2026, 10, 9).unwrap();
        assert!(BirthDate::on(9, 10, 2008, today).is_ok());
        assert!(BirthDate::on(8, 10, 2008, today).is_ok());
        assert_eq!(
            BirthDate::on(10, 10, 2008, today).unwrap_err(),
            "You must be 18 years or older."
        );
        assert!(BirthDate::on(1, 1, 2009, today).is_err());
        assert_eq!(
            BirthDate::on(10, 10, 2026, today).unwrap_err(),
            "Date of birth cannot be in the future."
        );
    }

    #[test]
    fn birth_date_eligibility_uses_server_date_not_client_year_cutoff() {
        let server_today = NaiveDate::from_ymd_opt(2026, 10, 9).unwrap();
        // A client clock one year ahead would offer 2009 in its year dropdown.
        assert_eq!(
            BirthDate::on(1, 1, 2009, server_today).unwrap_err(),
            "You must be 18 years or older."
        );
        // Even an allowed year is underage until the full birthday has passed.
        assert_eq!(
            BirthDate::on(10, 10, 2008, server_today).unwrap_err(),
            "You must be 18 years or older."
        );
    }

    #[test]
    fn birth_date_rejects_invalid_calendar_dates_and_ranges() {
        let today = NaiveDate::from_ymd_opt(2026, 10, 9).unwrap();
        for (day, month, year) in [
            (0, 1, 2000),
            (32, 1, 2000),
            (31, 4, 2000),
            (29, 2, 1900),
            (29, 2, 2001),
            (1, 0, 2000),
            (1, 13, 2000),
            (1, 1, 0),
            (1, 1, 999),
            (1, 1, 10000),
            (1, 1, u32::MAX),
        ] {
            assert_eq!(
                BirthDate::on(day, month, year, today).unwrap_err(),
                "Enter a valid date of birth."
            );
        }
        assert_eq!(
            BirthDate::on(29, 2, 2000, today).unwrap().database_value(),
            "2000-02-29"
        );
    }

    #[test]
    fn birth_date_leap_day_turns_eighteen_on_march_first_in_non_leap_year() {
        assert!(BirthDate::on(29, 2, 2008, NaiveDate::from_ymd_opt(2026, 2, 28).unwrap()).is_err());
        assert!(BirthDate::on(29, 2, 2008, NaiveDate::from_ymd_opt(2026, 3, 1).unwrap()).is_ok());
    }
}
