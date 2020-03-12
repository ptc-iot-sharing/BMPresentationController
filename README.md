# BMPresentationController

A set of widgets that presents a mashup in either a popup window or a popover.

## Index

- [About](#about)
- [Usage](#usage)
    + [Bindings and properties](#Bindings-and-properties)
    + [Installation](#installation)
- [Development](#development)

## About

This repository contains a set of widgets, the **Popover Controller** and the **Window Controller** built on top of [BMCoreUI](https://github.com/ptc-iot-sharing/BMCoreUI) to display a mashup in either a popup window or a popover. 

This enables creation of context menus, information tooltips, as well as modal popups and more.

## Usage

Both widgets work similarly in concept to the _Navigation_ widget, when used as a modal popup. The **Popover Controller** is intended to be uses to show popover, context menus or information tooltips that appear next to the content the user is interacting with, while the **Window Controller** is intended to be used to show popups and information dialogs, that show up in the middle of the screen.

### Bindings and properties

#### Properties

The following properties are available on both the **Popover Controller** and the **Window Controller**:

* **anchorKind**: The kind of anchor from which this controller will originate. In other words, describes the location where the popover will appear and the source for the window animation. Has the following options:
    * _Event Origin_: Uses the location of the event (the location where the user clicked or touched).
    * _Event Target_: Uses the location of the html element that the user has clicked or touched. 
    * _Selector_: Uses the location of the first html element found that matches the CSS selector in the _anchor_ property using [document.querySelector](https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector).
    * _Widget_: Uses the location of the widget with the display name equal to the _anchor_ property.
    * _None_: Defaults to using the _Event Origin_.
* **anchor**: _Binding Target_: See the **anchorKind** _Selector_ and _Widget_ options.
* **mashupName**: _Binding Target_: The name of the mashup to be displayed.
* **controllerWidth, controllerHeight**: The dimensions of the mashup that will be displayed.
* **Other Parameters**: The mashup parameters set on _mashupName_ will also be displayed for as properties of this widget.

The following properties are only available on the **Window Controller**:

* **modal**: Controls whether this window is modal.
* **movable**: Controls whether this window can be moved.
* **resizable**: Controls whether this window can be resized.
* **fullScreenButton**: If enabled, the window will have a toggle full screen button.
* **multipleWindows**: If enabled, the controller will be able to create multiple windows.

#### Services

* **bringToFront**: Shows this controller.
* **dismiss**: Dismisses this controller.

#### Events

* **controllerDidClose**: Triggered when this controller closes.

## Developing

### Installation
- Navigate to the [releases page](/releases)
- Under the latest release, view all the assets
- Download the file `BMPresentationController-min-<VERSION>.zip`
- Import the widget into Thingworx

# Development
This projects welcomes contributions. For details about pre-requisites, development environment and file structure, please see https://github.com/ptc-iot-sharing/ThingworxDemoWebpackWidget/tree/supportv2. 

To setup a development environment, run the following:
* `npm install`: installs the necessary development dependencies

To run a build:
* `npm run build`: builds the extension. Creates a new extension zip file under the `zip` folder.
* `npm run buildDev`: builds the extension with sourcemaps enabled. Creates a new extension zip file under the `zip` folder.
* `npm run upload`: creates a build, and uploads the extension zip to the thingworx server configured in `package.json`.

If you want to develop both _bm-core-ui_ and this package in parallel, you can use [npm link](https://docs.npmjs.com/cli/link.html). The following instructions should get you started:
1. In the `BMCoreUI` project folder, run `npm link`
2. In the `BMPresentationController`, run `npm link bm-core-ui`

This will create a symlink in `BMPresentationController\node_modules\bm-core-ui` to the `BMCoreUI` folder.