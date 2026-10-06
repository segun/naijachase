use naijachase_contracts::{Command, Event, GameState};
use serde::{Deserialize, Serialize};
use std::{
    env,
    io::{self, Read},
    path::Path,
};
#[derive(Deserialize)]
struct Case {
    state: GameState,
    commands: Vec<Command>,
}
#[derive(Serialize)]
struct Outcome {
    state: GameState,
    events: Vec<Event>,
    error: Option<String>,
}
fn main() {
    if env::args().nth(1).as_deref() == Some("validate-content") {
        let root = env::args().nth(2).unwrap_or_else(|| "..".into());
        match naijachase_content::CatalogueSummary::load(Path::new(&root)) {
            Ok(v) => {
                println!(
                    "{} missions, {} states, {} thieves",
                    v.missions, v.states, v.thieves
                );
                return;
            }
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(2)
            }
        }
    }
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let cases: Vec<Case> = match serde_json::from_str(&input) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("invalid input: {e}");
            std::process::exit(2)
        }
    };
    let mut out = Vec::with_capacity(cases.len());
    for case in cases {
        let mut state = case.state;
        let mut events = vec![];
        let mut error = None;
        for command in case.commands {
            match naijachase_core::apply(state.clone(), command) {
                Ok(result) => {
                    state = result.0;
                    events.extend(result.1)
                }
                Err(e) => {
                    error = Some(e.to_string());
                    break;
                }
            }
        }
        out.push(Outcome {
            state,
            events,
            error,
        })
    }
    println!("{}", serde_json::to_string(&out).unwrap());
}
