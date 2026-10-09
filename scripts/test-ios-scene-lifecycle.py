"""Check the UIKit launch configuration required by the iOS 27 SDK."""
from pathlib import Path
import plistlib
import unittest


ROOT = Path(__file__).resolve().parents[1]


class SceneLaunchConfiguration(unittest.TestCase):
    def test_single_window_has_a_scene_delegate(self):
        info = plistlib.loads((ROOT / "ios/App/App/Info.plist").read_bytes())
        manifest = info.get("UIApplicationSceneManifest", {})
        configurations = manifest.get("UISceneConfigurations", {}).get(
            "UIWindowSceneSessionRoleApplication", []
        )
        self.assertEqual(len(configurations), 1, "iOS 27 requires a configured scene")
        self.assertIs(manifest.get("UIApplicationSupportsMultipleScenes"), False)
        self.assertEqual(
            configurations[0].get("UISceneDelegateClassName"),
            "$(PRODUCT_MODULE_NAME).SceneDelegate",
        )

    def test_programmatic_window_does_not_also_load_main_storyboard(self):
        info = plistlib.loads((ROOT / "ios/App/App/Info.plist").read_bytes())
        self.assertNotIn("UIMainStoryboardFile", info)
        for configurations in info.get("UIApplicationSceneManifest", {}).get(
            "UISceneConfigurations", {}
        ).values():
            for configuration in configurations:
                self.assertNotIn("UISceneStoryboardFile", configuration)
        self.assertEqual(info["UILaunchStoryboardName"], "LaunchScreen")


if __name__ == "__main__":
    unittest.main()
