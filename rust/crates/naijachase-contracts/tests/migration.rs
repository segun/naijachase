use naijachase_contracts::migrate_legacy_state;
#[test]
fn migrates_unversioned_and_v2() {
    for text in [
        r#"{"mission_id":"NG-M0001","elapsed":5,"stage":0,"current_state":"Abia","evidence":{},"case_score":650}"#,
        r#"{"save_version":2,"active":{"state_version":2,"mission_id":"NG-M0001","elapsed":5,"stage":0,"current_state":"Abia","evidence":{},"observed_traits":{"hair":"short"},"case_score":650}}"#,
    ] {
        let v = serde_json::from_str(text).unwrap();
        let s = migrate_legacy_state(&v, vec!["Abia".into()], "NG-T001".into(), 2, 0).unwrap();
        assert_eq!(s.mission_id, "NG-M0001");
        assert_eq!(s.version, 1);
    }
}
