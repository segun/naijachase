pub trait StateStore {
    type Error;
    fn load(&self, id: &str) -> Result<Option<Vec<u8>>, Self::Error>;
    fn save(&self, id: &str, version: u64, data: &[u8]) -> Result<(), Self::Error>;
}
