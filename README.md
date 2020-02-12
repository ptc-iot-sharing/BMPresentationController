# Intro

A set of widgets that presents a mashup in either a popup window or a popover.

## Developing

### Required software

The following software is required:

* [NodeJS](https://nodejs.org/en/) needs to be installed and added to the `PATH`. You should use the LTS version.

The following software is recommended:

* [Visual Studio Code](https://code.visualstudio.com/): An integrated developer enviroment with great typescript support. You can also use any IDE of your liking, it just that most of the testing was done using VSCode.

### Proposed folder structure

```
demoWebpackTypescriptWidget
│   README.md         // this file
│   package.json      // here you specify project name, homepage and dependencies. This is the only file you should edit to start a new project
│   tsconfig.json     // configuration for the typescript compiler
│   webpack.config.js // configuration for webpack
│   metadata.xml      // thingworx metadata file for this widget. This is automatically generated based on your package.json
│   index.html        // when testing the widget outside of thingworx, the index file used.
└───src               // main folder where your developement will take place
│   │   index.ts               // source file used when testing the widget outside of twx
│   │   demoWebpack.ide.ts     // source file for the Composer section of the widget
│   │   demoWebpack.runtime.ts // source file for the Runtime section of the widget
│   └───internalLogic          // usually, put the enternal logic into a separate namespace
│   │   │   file1.ts           // typescript file with internal logic
│   │   │   file2.js           // javascript file in ES2015 with module
│   │   │   ...
│   └───styles        // folder for css styles that you can import into your app using require statements
│   └───images        // folder for image resources you are statically including using require statements
│   └───static        // folder for resources that are copied over to the development extension. Think of folder of images that you referece only dynamicaly
└───build         // temporary folder used during compilation
└───zip               // location of the built extension
```

### Developing a new widget

In order to start developing a new widget using this template you need to do the following:

1. Clone this repository
    ```
    git clone http://roicentersvn.ptcnet.ptc.com/placatus/DemoWebpackWidget.git
    ```
2. Open `package.json` and configure the `name`, `description`, and other fields you find relevant
3. Run `npm install`. This will install the development dependencies for this project.
4. Run `npm run init`. This will create sample runtime and ide typescript files using the name.
5. Start working on your widget.

### Adding dependencies

Dependencies can be added from [npm](https://www.npmjs.com/), using the `npm install DEPENDENCY_NAME --save` command, or by adding them directly to `package.json`, under `dependencies`. After adding them to `package.json`, you should run `npm install`.
If you are using a javascript library that also has typescript mappings you can install those using `npm install --save @types/DEPENDENCY_NAME`.

### Building and publishing

The following commands allow you to build and compile your widget:

* `npm run build`: builds the production version of the widget. Creates a new extension zip file under the `zip` folder. The production version is optimized for sharing and using in production enviroments.
* `npm run upload`: creates a build, and uploads the extension zip to the thingworx server configured in `package.json`. The build is created for developement, with source-maps enabled.
* `npm run watch`: watches the source files, and whenever they change, do a build.

## Example of widgets that use this starter kit

* [SVGViewer](http://roicentersvn/placatus/SvgViewerWidget): Allows viewing, interacting and manipulating SVG files in Thingworx. Contains examples of using external libraries.
* [BMView](http://roicentersvn/BogdanMihaiciuc/BMView): Allows using BMView and constraint-based layouts in Thingworx.
* [BMCollectionView](http://roicentersvn/BogdanMihaiciuc/BMCollectionView): Displays a highly customizable collection of reusable items.
* [Calendar](http://roicentersvn/BogdanMihaiciuc/Calendar): A calendar widget for Thingworx built using the fullcalendar library.  Contains examples of using external libraries as well as referencing global external libraries without including them in the built package.
* [mxDiagramViewer](http://roicentersvn/placatus/MxGraphDiagramWidget): Uses an much older version of this starter kit. Contains examples of using external libraries.