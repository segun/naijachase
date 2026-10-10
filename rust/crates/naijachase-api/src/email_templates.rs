//! Branded transactional emails. Colours mirror `web/src/styles/tokens.css`.
//! Email clients ignore external CSS and CSS variables, so everything is inline and table based.

pub struct EmailContent {
    pub subject: &'static str,
    pub text: String,
    pub html: String,
}

fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn layout(
    preheader: &str,
    heading: &str,
    body: &str,
    button: &str,
    link: &str,
    footer: &str,
) -> String {
    let link = escape(link);
    format!(
        r##"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>{heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#04100c;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#04100c;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#04100c;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background-color:#081d17;border:1px solid #21503f;border-radius:14px;">
<tr><td style="padding:28px 32px 20px 32px;border-bottom:1px solid #173a2e;font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#f2c14e;">Naija Chase</td></tr>
<tr><td style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f6f1e1;">
<h1 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;font-weight:normal;color:#ffe39a;">{heading}</h1>
<p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;color:#f6f1e1;">{body}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;"><tr><td bgcolor="#2bd985" style="border-radius:8px;background-color:#2bd985;">
<a href="{link}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:bold;color:#04100c;text-decoration:none;border-radius:8px;">{button}</a>
</td></tr></table>
<p style="margin:0 0 6px 0;font-size:13px;line-height:1.5;color:#a4bdb0;">Button not working? Copy and paste this link into your browser:</p>
<p style="margin:0 0 24px 0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="{link}" style="color:#7cc4ff;">{link}</a></p>
<p style="margin:0;padding-top:20px;border-top:1px solid #173a2e;font-size:13px;line-height:1.5;color:#a4bdb0;">{footer}</p>
</td></tr>
</table>
<p style="margin:16px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#a4bdb0;">Naija Chase &middot; Track the culprit across all 36 states and the FCT.</p>
</td></tr>
</table>
</body>
</html>"##
    )
}

pub fn confirmation(link: &str) -> EmailContent {
    EmailContent {
        subject: "Confirm your Naija Chase account",
        text: format!(
            "Welcome to Naija Chase!\n\nConfirm your email address to activate your account:\n{link}\n\nIf you did not create this account, you can ignore this email."
        ),
        html: layout(
            "Confirm your email address to start your first case.",
            "Welcome, Investigator",
            "Your account is almost ready. Confirm your email address to start your first case.",
            "Confirm email address",
            link,
            "If you did not create a Naija Chase account, you can safely ignore this email.",
        ),
    }
}

pub fn password_reset(link: &str) -> EmailContent {
    EmailContent {
        subject: "Reset your Naija Chase password",
        text: format!(
            "We received a request to reset your Naija Chase password.\n\nChoose a new password here:\n{link}\n\nIf you did not request this, you can ignore this email and your password will stay the same."
        ),
        html: layout(
            "Choose a new password for your Naija Chase account.",
            "Reset your password",
            "We received a request to reset the password for your Naija Chase account. Use the button below to choose a new one.",
            "Reset password",
            link,
            "If you did not request a password reset, you can safely ignore this email. Your password will not change.",
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn templates_include_link_and_escape_it() {
        let email = password_reset("https://x.test/?reset=a&b=\"c");
        assert!(email.html.contains("reset=a&amp;b=&quot;c"));
        assert!(email.text.contains("reset=a&b="));
        assert!(
            confirmation("https://x.test/?confirm=t")
                .html
                .contains("Confirm email address")
        );
    }
}
