// Adopts the UIScene life cycle on iOS. Apps built with the iOS 27 SDK that
// don't adopt it are killed at launch (EXC_BREAKPOINT in
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption).
//
// Mirrors the Expo SDK 58 template wiring, using ExpoAppSceneDelegate which
// ships in expo >= 57.0.26 but isn't wired into the SDK 57 template.
// Remove this plugin after upgrading to SDK 58+, whose template already does this.
const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withAppDelegate,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

const SCENE_DELEGATE_FILE = 'SceneDelegate.swift';
const SCENE_DELEGATE_SOURCE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

function withSceneReadyAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate.');
    }
    let src = cfg.modResults.contents;

    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      const next = src.replace(
        /class AppDelegate: ExpoAppDelegate\s*\{/,
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {'
      );
      if (next === src) {
        throw new Error('withSceneLifecycle: AppDelegate class declaration not found.');
      }
      src = next;
    }

    // SceneDelegate now creates the window and starts React Native into it.
    const windowSetup =
      /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;
    if (windowSetup.test(src)) {
      src = src.replace(
        windowSetup,
        '\n    // The window is created and React Native is started by SceneDelegate (UIScene life cycle).\n'
      );
    } else if (src.includes('UIWindow(frame: UIScreen.main.bounds)')) {
      throw new Error('withSceneLifecycle: could not remove the AppDelegate window setup.');
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

function withSceneDelegateFile(config) {
  return withXcodeProject(config, (cfg) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    fs.writeFileSync(
      path.join(cfg.modRequest.platformProjectRoot, projectName, SCENE_DELEGATE_FILE),
      SCENE_DELEGATE_SOURCE
    );
    // No-ops if the file is already in the group.
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: `${projectName}/${SCENE_DELEGATE_FILE}`,
      groupName: projectName,
      project: cfg.modResults,
    });
    return cfg;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneDelegateFile(withSceneReadyAppDelegate(withSceneManifest(config)));
};
