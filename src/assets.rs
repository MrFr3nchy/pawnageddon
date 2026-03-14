//! Load and cache piece textures from the assets folder.
//! Call set_pc_assets_folder() with the resolved assets path *before* load_all().

use macroquad::prelude::{load_texture, Texture2D};
use std::collections::HashMap;

use crate::pieces::asset_name;

/// Map from piece char (e.g. 'r', 'K') to loaded texture. Missing assets are None.
pub struct PieceTextures {
    pub textures: HashMap<char, Option<Texture2D>>,
}

impl PieceTextures {
    /// Load all piece textures. Uses only the filename (e.g. "pawn-white.png");
    /// path is resolved by macroquad relative to the folder set in set_pc_assets_folder().
    pub async fn load_all() -> Self {
        let pieces = ['r', 'n', 'b', 'q', 'k', 'p', 'R', 'N', 'B', 'Q', 'K', 'P'];
        let mut textures = HashMap::new();
        for p in pieces {
            let tex = match asset_name(p) {
                Some(name) => load_texture(name).await.ok(),
                None => None,
            };
            textures.insert(p, tex);
        }
        Self { textures }
    }

    /// Get texture for piece char. Returns None if asset missing or not a piece.
    pub fn get(&self, piece: char) -> Option<&Texture2D> {
        self.textures.get(&piece).and_then(|t| t.as_ref())
    }
}
