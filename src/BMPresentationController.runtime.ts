
import { TWWidgetDefinition, property, canBind, didBind, TWEvent, event, service } from 'typescriptwebpacksupport/widgetruntimesupport';
import { BMPresentationControllerAnchorKind } from './shared/constants';


declare global {
    interface Window {
        BMMaterialFontsLoaded: boolean;
    }
}

/**
 * Returns the widget with the specified id by searching the target mashup.
 * {
 * 	@param withId <String, nullable> 					Required if named is not specified. The ID of the widget to find
 * 	@param named <String, nullable>						The display name of the widget, if specified, the search will find the first widget 
 *														that has the specified id (if given) or the speficied display name.
 * 	@param inMashup <TWMashup>							The mashup object in which to search.
 * 	@param traverseContainedMashup <Boolean, nullable> 	Defaults to false. If set to true, the search will include other mashups contained within the source mashup.
 * }
 * @return <TWWidget, nullable> 						The actual widget object if found, null otherwise
 */
function BMFindWidget(args) {
	var id = args.withId;
	var mashup = args.inMashup;
	var name = args.named;
	
	if (!mashup) mashup = TW.Runtime.Workspace.Mashups.Current;
	
	return BMFindWidgetRecursive(id, name, mashup.rootWidget, args.traverseContainedMashup);
}

function BMFindWidgetRecursive(id, name, container, includeContainedMashup) {
	
	var widgets = container.getWidgets();
	var length = widgets.length;
	
	for (var i = 0; i < length; i++) {
		var widget = widgets[i];
		
		if (widget.idOfThisElement == id || widget.properties.Id == id) return widget;
		if (widget.properties.DisplayName == name) return widget;
		
		var subWidgets = widget.getWidgets();
		if (widget.properties.__TypeDisplayName == "Contained Mashup" && !includeContainedMashup) continue;
		if (subWidgets.length > 0) {
			widget = BMFindWidgetRecursive(id, name, widget, includeContainedMashup);
			
			if (widget) return widget;
		}
		
		
	}
	
	return null;
	
}

declare const Encoder: any;

interface BMControllerMashup extends TWMashup {
    BM_setParameterInternal(parameter: string, value: any);
    _BMView: BMView;
}

declare class DataManager {}

/**
 * A view subclass that manages the DOMNode associated with a mashup root widget
 */
export class BMMashupView extends BMView {

	protected _contentNode!: DOMNode;

	get _supportsAutomaticIntrinsicSize(): boolean {return NO}

	// @override - BMView
	get contentNode() {
		return this._contentNode || this.node;
	}

	/**
	 * Constructs and returns a mashup view for the given mashup.
	 * @param mashup		The mashup.
	 * @return				A mashup view.
	 */
	static viewForMashup(mashup: TWMashup): BMMashupView {
		let view: BMMashupView = BMView.viewForNode.call(this, mashup.rootWidget.boundingBox[0]) as BMMashupView;

		view._contentNode = mashup.rootWidget.jqElement[0];

		return view;
	}

}

let BMControllerSerialVersion = 0;

@TWWidgetDefinition export class BMControllerBase extends TWRuntimeWidget implements BMWindowDelegate {

    /**
     * The kind of anchor to use.
     */
    @property anchorKind: BMPresentationControllerAnchorKind;

    /**
     * The anchor selector, for `Widget` and `Selector` anchor kinds.
     */
    @property anchor: string;

    _mashupName: string;
    @property set mashupName(mashup: string) {
        if (mashup == this._mashupName) return;

        this._mashupName = mashup;

        this.loadMashupDefinitionWithName(mashup);
    }

    /**
     * The controller instance.
     */
    controller?: BMWindow;

    _parameters: any;

    _previousMashupInstance?: BMControllerMashup;

    _mashupDefinition: TWMashupEntityDefinition;

    /**
     * The controller's width.
     */
    @property controllerWidth: number;

    /**
     * The controller's height.
     */
    @property controllerHeight: number;

	/**
	 * The mashup instance managed by this controller.
	 */
	_mashupInstance?: BMControllerMashup;

	/**
	 * The mashup instance managed by this controller.
	 */
	get mashupInstance(): BMControllerMashup | undefined {
		return this._mashupInstance;
    }
    
    /**
     * A promise that is resolved when the mashup definition has loaded.
     */
    protected mashupDefinitionPromise: Promise<void>;

    /**
     * Retrieves and caches the definition for the given mashup.
     * If the mashup definition is already cached, it is returned synchronously.
     * If this mashup definition is requested asynchronously while there is already a pending request for this mashup,
     * a new request will not be created. Instead, the completion handler will be added to the already existing request.
     * @param name <String>																				The name of the mashup whose definition to retrieve.
     * {
     *  @param completionHandler <void ^(nullable TWMashupDefinition, nullable error), nullable>		A completion handler to invoke when the mashup definition was retrieved or an error occurs.
     * 																									The handler returns nothing and receives two parameters:
     * 																										- The mashup definition if it could be retrieved
     * 																										- The error if the mashup definition could not be retrieved
     * }
     * @return <TWMashupDefinition, nullable OR Promise>												The mashup definition if the request was atomic and it could be retrieved,
     * 																									undefined otherwise. 
     * 																									If the request is nonatomic, this function will return a promise that resolves when the request completes.
     */
    private loadMashupDefinitionWithName(name: string, args: {completionHandler?: (mashup?: (TWMashupEntityDefinition | undefined), error?: (Error | undefined)) => void} = {}): Promise<TWMashupEntityDefinition> {
        var request;
        var promise;

        // If the request is nonatomic and there isn't already a pending request, create it now
        request = new XMLHttpRequest();

        // Wrap the callback in a callback collection to allow multiple requests to the same mashup to execute together
        request._BMCallbackCollection = BMFunctionCollectionMake();

        // Create a promise that will be returned by this function, allowing this function to be awaited for in async functions
        request._BMPromise = new Promise(function (resolve, reject) {
            request._BMResolve = resolve;
            request._BMReject = reject;
        });
        promise = request._BMPromise;

        // Push the callback into the callback collection
        if (args.completionHandler) {
            request._BMCallbackCollection.push(args.completionHandler);
        }
        
        request.open('GET', "/Thingworx/Mashups/" + TW.encodeEntityName(name), YES);
        
        request.setRequestHeader('Content-Type', 'application/json');
        request.setRequestHeader('Accept', 'application/json');
        request.setRequestHeader('x-thingworx-session', 'true');
        
        // This will hold the actual mashup object once the XHR finishes loading
        var mashupDefinition;

        const self = this;
        
        request.onload = function (data) {
            if (this.status == 200) {
                mashupDefinition = JSON.parse(request.responseText);
                
                // Then invoke the completion handler
                this._BMCallbackCollection(mashupDefinition);

                // Resolve the promise
                this._BMResolve && this._BMResolve(mashupDefinition);

                self.mashupDefinitionDidLoad(mashupDefinition);
            }
            else {
                var error = new Error('The mashup could not be loaded. The server returned status code ' + this.status);
                this._BMCallbackCollection(undefined, error);
                this._BMReject && this._BMReject(error);
                

            }
        };
        
        request.onerror = function (error) {
            TW.Runtime.showStatusText('permission-error', 'Could not load "' + Encoder.htmlEncode(name) + '". Reason: ' + request.status + ' - ' + request.responseText, true);
            this._BMCallbackCollection(undefined, error);
            this._BMReject && this._BMReject(error);
        };
        
        this.mashupDefinitionPromise = request._BMPromise;

        request.send();
        return promise;
    }


    protected mashupDefinitionDidLoad(definition: TWMashupEntityDefinition) {
        this._mashupDefinition = definition;
    }

	/**
	 * Causes this cell to render and display the given mashup, if it corresponds to the mashup that this cell manages,
	 * otherwise this method does nothing.
	 * If this cell is already managing a mashup when this method is invoked, that mashup will be destroyed before the new one is created.
	 * If this cell is in a recycled state when this method is invoked, mashup rendering will be deferred to <code>prepareForDisplay()</code>
	 * @param named <String>							The name of the mashup to render.
	 * {
	 * 	@param withDefinition <TWMashupDefinition>		The mashup definition object.
	 * }
	 */
	protected renderMashupNamed(named: string, args: {withDefinition: TWMashupEntityDefinition}) {
		// Don't do anything if this mashup no longer corresponds to this cell's mashup
		if (named != this.mashupName) return;

		this._mashupDefinition = args.withDefinition;
		let definition = args.withDefinition;

		// Destroy the current mashup if there is one
		if (this._mashupInstance) {
			this._previousMashupInstance = this._mashupInstance;
		}

		var self = this;

		// Save a reference to the currently loaded mashup and its HTML ID so it can be restored afterwards
		var currentHTMLID = TW.Runtime.HtmlIdOfCurrentlyLoadedMashup;
		var currentMashup = TW.Runtime.Workspace.Mashups.Current;
		
		// A new container has to be created for the mashup
		// because it gets removed when the mashup is destroyed
		var containerNode: HTMLDivElement = document.createElement('div');
		containerNode.classList.add('BMControllerMashup');
		this.controller.contentView.node.appendChild(containerNode);
		var container: $ = $(containerNode);

		// If there was a previous mashup that should be destroyed,
		// the new mashup starts out transparent
		if (this._previousMashupInstance) {
			containerNode.style.opacity = '.0000';
		}
		
		// Increment the mashup serial version to generate a unique ID for this mashup
		BMControllerSerialVersion++;
		
		var mashupContent = definition.mashupContent;
		
		// Construct the mashup object and its associated data object
		var mashup = new TW.MashupDefinition() as BMControllerMashup;
		this._mashupInstance = mashup;
		
		mashup.dataMgr = new DataManager() as TWDataManager;
		
		// Set up the unique IDs
		// Replace dots with underscores so they don't throw off the jQuery selectors used by Thingworx
		mashup.rootName = definition.name.replace(/\./g, '_') + '-BMController-' + BMControllerSerialVersion;
		container.attr('id', mashup.rootName);
		mashup.htmlIdOfMashup = '#' + mashup.rootName;
		TW.Runtime.HtmlIdOfCurrentlyLoadedMashup = mashup.htmlIdOfMashup;
		
		mashup.mashupName = definition.name;
		
		// Trigger the mashup load
		mashup.loadFromJSON(mashupContent, definition);
		
		// Construct the bindings
		mashup.dataMgr.migrateAnyBindings(mashup);
		TW.Runtime.Workspace.Mashups.Current = mashup;

        // If the root widget of the new mashup is a view, attach it as a subview of the cell
        let rootWidget = this._mashupInstance.rootWidget.getWidgets()[0] as any;

        // Prevent the root view from initiating a layout pass before this cell is ready for display
        if (rootWidget && rootWidget.coreUIView) {
            rootWidget._skipInitialLayoutPass = YES;
        }
        
        // Otherwise draw the mashup into the container using the standard Thingworx method
        mashup.rootWidget.appendTo(container, mashup);

		// Create the data manager
		mashup.dataMgr.loadFromMashup(mashup);

        // If the root widget of the new mashup is a view, attach it as a subview of the cell
        // Create a view for the mashup widget and add the root view as a sub-widget
        if (rootWidget && rootWidget.coreUIView) {
            let mashupView: BMMashupView = BMMashupView.viewForMashup(mashup);
            mashup._BMView = mashupView;
            this.controller.contentView.addSubview(mashupView, {toPosition: 0});

            let rootView: BMView = rootWidget.coreUIView;
            mashupView.addSubview(rootView);

            // Additionally, the root widget is to be added a subview to the mashup view with a set of constraints
            BMLayoutConstraint.constraintWithView(rootView, {attribute: BMLayoutAttribute.Left, toView: mashupView, secondAttribute: BMLayoutAttribute.Left}).isActive = YES;
            BMLayoutConstraint.constraintWithView(rootView, {attribute: BMLayoutAttribute.Top, toView: mashupView, secondAttribute: BMLayoutAttribute.Top}).isActive = YES;
            BMLayoutConstraint.constraintWithView(rootView, {attribute: BMLayoutAttribute.Width, toView: mashupView, relatedBy: BMLayoutConstraintRelation.Equals, secondAttribute: BMLayoutAttribute.Width}).isActive = YES;
            BMLayoutConstraint.constraintWithView(rootView, {attribute: BMLayoutAttribute.Height, toView: mashupView, relatedBy: BMLayoutConstraintRelation.Equals, secondAttribute: BMLayoutAttribute.Height}).isActive = YES;

            // Similarly, the mashup root widget has to be linked to the cell
            BMLayoutConstraint.constraintWithView(mashupView, {attribute: BMLayoutAttribute.Left, toView: this.controller.contentView, secondAttribute: BMLayoutAttribute.Left}).isActive = YES;
            BMLayoutConstraint.constraintWithView(mashupView, {attribute: BMLayoutAttribute.Top, toView: this.controller.contentView, secondAttribute: BMLayoutAttribute.Top}).isActive = YES;
            BMLayoutConstraint.constraintWithView(mashupView, {attribute: BMLayoutAttribute.Width, toView: this.controller.contentView, relatedBy: BMLayoutConstraintRelation.Equals, secondAttribute: BMLayoutAttribute.Width}).isActive = YES;
            BMLayoutConstraint.constraintWithView(mashupView, {attribute: BMLayoutAttribute.Height, toView: this.controller.contentView, relatedBy: BMLayoutConstraintRelation.Equals, secondAttribute: BMLayoutAttribute.Height}).isActive = YES;

        }
		
		(mashup as any).parameterDefinitions = (definition as any).parameterDefinitions;
		
		// Store a reference to this mashup in the container's data dictionary
		container.data('mashup', mashup);

		// Add a hook into setParameter, to allow data updates; set this up after providing the initial values to parameters
		mashup.BM_setParameterInternal = mashup.setParameter;
		mashup.setParameter = function (key, value) {
			// Allow the mashup to update the parameter internally
			this.BM_setParameterInternal(key, value);
			
			// Otherwise publish the update to the data property
			this.parameters[key] = value;
			
			// Dispatch a property update to the Thingworx runtime
			self.setProperty(key, value);
			
		};
		
		// Set up the parameter values
		if (self._parameters) self._setParametersInternal();
		
		// Fire the MashupLoaded event to signal that loading is complete
        mashup.fireMashupLoadedEvent();
        
        
        // Restore the previous mashup ID and object
        TW.Runtime.HtmlIdOfCurrentlyLoadedMashup = currentHTMLID;
		TW.Runtime.Workspace.Mashups.Current = currentMashup;
		
		// If there was a previous mashup that should be destroyed, run an animation and then destroy it
		if (this._previousMashupInstance) {
			let previousMashupInstance = this._previousMashupInstance;
            this._previousMashupInstance = undefined;
            previousMashupInstance.destroyMashup();
            if (previousMashupInstance._BMView) {
                previousMashupInstance._BMView.release();
            }
		}
    }

    /**
     * Creates the mashup for this controller. The `controller` property must be an instance of
     * `BMWindow` when this method is invoked.
     */
    protected createMashup() {
        this.renderMashupNamed(this.mashupName, {withDefinition: this._mashupDefinition});
    }
    
    /**
     * Destroys the current mashup.
     */
    protected destroyMashup() {
        if (this._mashupInstance) {
            this._mashupInstance.destroyMashup();
            this._mashupInstance = undefined;
        }
    }

	/**
	 * Invoked internally by the mashup cell to update the managed mashup's parameters
	 * to the values currently used by the cell.
	 */
	_setParametersInternal(): void {

		var mashup = this._mashupInstance;
		if (mashup && this._parameters) {
			for (var parameter in this._parameters) {
				mashup.BM_setParameterInternal(parameter, this._parameters[parameter]);
			}
			
			
			// Run a layout pass if the root widget is a BMView
			let rootWidget = mashup.rootWidget.getWidgets()[0] as any;

			// Trigger a blocking layout pass
			if (rootWidget && rootWidget.coreUIView) {
				rootWidget.coreUIView.layout();
			}
		}
    }
    
    _mashupParameters: Dictionary<any>;

    // @override - TWRuntimeWidget
    renderHtml(): string {
        return `<div class="widget-content"></div>`;
    };

    // @override - TWRuntimeWidget
    async afterRender(): Promise<void> {
        require('./styles/runtime.css');

        // TODO: Need a better way to include this
        if (!window.BMMaterialFontsLoaded) {
            window.BMMaterialFontsLoaded = YES;
            
            $('head').append('<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">');
        }

        this.boundingBox[0].style.display = 'none';

        this._parameters = {};

        this._mashupParameters = JSON.parse(this.getProperty('_mashupFields'));
        for (const key in this._mashupParameters) {
            this._parameters[key] = this.getProperty('key');
        }

        if (this.mashupName) {
            this._mashupName = this.mashupName;
            this.loadMashupDefinitionWithName(this.mashupName);
        }
    }

    updateProperty(info: TWUpdatePropertyInfo) {
        super.updateProperty(info);
        if (info.TargetProperty in this._mashupParameters) {
            this._parameters[info.TargetProperty] = info.SinglePropertyValue;
            this.setProperty(info.TargetProperty, info.SinglePropertyValue);
            if (this._mashupInstance) {
                this._mashupInstance.BM_setParameterInternal(info.TargetProperty, info.SinglePropertyValue);
            }
        }
    }

    /**
     * Triggered upon the controller closing.
     */
    @event controllerDidClose: TWEvent;

    windowWillClose(window: BMWindow) {
        this.controllerDidClose();
    }

    windowDidClose(window: BMWindow) {
        this.destroyMashup();
        this.controller.release();
        this.controller = undefined;
    }

    // @override - TWRuntimeWidget
    beforeDestroy?(): void {
        if (this._mashupInstance) {
            this._mashupInstance.destroyMashup();
        }
        if (this.controller) {
            this.controller.release();
        }
    }
}

@TWWidgetDefinition export class BMPopoverController extends BMControllerBase implements BMWindowDelegate {

    @service async bringToFront() {
        const popover = BMPopover.popoverWithSize(BMSizeMake(this.controllerWidth || 400, this.controllerHeight || 400));

        switch (this.anchorKind) {
            case BMPresentationControllerAnchorKind.None:
                // None is not really supported for popovers. This will default to the event origin
            case BMPresentationControllerAnchorKind.EventOrigin:
                // For event, only mouse and touch events are supported as other event kinds don't
                // provide appropriate coordinates
                if (window.event) {
                    if (window.event instanceof MouseEvent) {
                        const event = window.event as MouseEvent;
                        popover.anchorPoint = BMPointMake(event.clientX, event.clientY);
                    }
                    else if (window.event instanceof TouchEvent) {
                        const touch = window.event.changedTouches[0];
                        popover.anchorPoint = BMPointMake(touch.clientX, touch.clientY);
                    }
                }
                break;
            case BMPresentationControllerAnchorKind.EventTarget:
                if (window.event && window.event instanceof UIEvent) {
                    popover.anchorNode = (window.event as any)._BMOriginalTarget || window.event.currentTarget as HTMLElement || window.event.target as HTMLElement;
                }
                break;
            case BMPresentationControllerAnchorKind.Selector:
                // For selector, find the element according to the selector
                const node = document.querySelector(this.anchor) as DOMNode;
                if (node) {
                    popover.anchorNode = node;
                }
                break;
            case BMPresentationControllerAnchorKind.Widget:
                // For widget, find the widget based on its display name
                const widget = BMFindWidget({named: this.anchor, inMashup: this.mashup});
                if (widget) {
                    popover.anchorNode = widget.boundingBox[0];
                }
                break;
        }

        await this.mashupDefinitionPromise;

        // If a valid anchor has been identified, bring up the popover
        if (popover.anchorNode || popover.anchorPoint) {
            this.controller = popover;
            popover.delegate = this;
            popover.bringToFrontAnimated(YES);
            this.createMashup();
        }
        else {
            // Otherwise cancel this action
            popover.release();
        }
    }

}

@TWWidgetDefinition export class BMWindowController extends BMControllerBase implements BMWindowDelegate {

    /**
     * The anchor node, if it exists.
     */
    anchorNode?: DOMNode;

    DOMNodeForDismissedWindow() {
        return this.anchorNode;
    }

    /**
     * The anchor point, if it exists.
     */
    anchorPoint?: BMPoint;

    rectForDismissedWindow() {
        if (this.anchorPoint) return BMRectMakeWithOrigin(this.anchorPoint, {size: BMSizeMake(1, 1)});
    }

    windowShouldKeepNodeHidden() {
        return YES;
    }

    resizeListener?: (event: Event) => void;

    windowWillClose(popup) {
        super.windowWillClose(popup);

        if (this.modal) {
            window.removeEventListener('resize', this.resizeListener);
        }
    }

    /**
     * Controls whether this window is modal.
     */
    @property modal: boolean;

    /**
     * Controls whether this window can be moved.
     */
    @property movable: boolean;

    /**
     * Controls whether this window can be resized.
     */
    @property resizable: boolean;

    /**
     * Controls whether this window can be resized.
     */
    @property closeButton: boolean;

    /**
     * Controls whether this window can be resized.
     */
    @property fullScreenButton: boolean;

	/**
	 * Constructs and returns a toolbar button DOM node. This node will not be added to the document automatically.
	 * @param className <String>			A list of class names that should be assigned to the button.
	 * {
	 * 	@param content <String>				The HTML content that this button should contain.
	 * 	@param action <void ^ (Event)>		An callback function that will be invoked whenever this button is clicked.
	 * 	@param tooltip <String, nullable>	If specified, this represent a tooltip text that appears when hovering over the button.
	 * }
	 * @return <DOMNode>					The button that was created.
	 */
	createToolbarButtonWithClass(className, args: {forWindow: BMWindow, content: string, action: () => void, tooltip?: string}) {
		var button = document.createElement('div');
		button.className = 'BMWindowControllerToolbarButton ' + className;
		button.innerHTML = args.content;
		args.forWindow.toolbar.appendChild(button);
		button.addEventListener('click', args.action);

		if (args.tooltip) {
			button.classList.add('BMHasTooltip');
			button.classList.add('BMTooltipPositionBottom');
			button.setAttribute('data-bm-tooltip', args.tooltip);
		}

		return button;
	}

    @service async bringToFront() {
        const popup = BMWindowMakeWithFrame(BMRectMakeWithOrigin(BMPointMake(0,0), {size: BMSizeMake(this.controllerWidth || 400, this.controllerHeight || 400)}), {modal: this.modal, toolbar: !this.modal || this.closeButton || this.fullScreenButton});
        popup.frame.center = BMPointMake(window.innerWidth / 2 | 0, window.innerHeight / 2 | 0);
        popup.frame = popup.frame;

        const args = {fromNode: undefined, fromRect: undefined};

        switch (this.anchorKind) {
            case BMPresentationControllerAnchorKind.None:
                // None is not really supported for popovers. This will default to the event origin
            case BMPresentationControllerAnchorKind.EventOrigin:
                // For event, only mouse and touch events are supported as other event kinds don't
                // provide appropriate coordinates
                if (window.event) {
                    if (window.event instanceof MouseEvent) {
                        const event = window.event as MouseEvent;
                        args.fromRect = BMRectMakeWithOrigin(BMPointMake(event.clientX, event.clientY), {size: BMSizeMake(1, 1)});
                    }
                    else if (window.event instanceof TouchEvent) {
                        const touch = window.event.changedTouches[0];
                        args.fromRect = BMRectMakeWithOrigin(BMPointMake(touch.clientX, touch.clientY), {size: BMSizeMake(1, 1)});
                    }
                }
                break;
            case BMPresentationControllerAnchorKind.EventTarget:
                if (window.event && window.event instanceof UIEvent) {
                    args.fromNode = (window.event as any)._BMOriginalTarget || window.event.currentTarget as HTMLElement || window.event.target as HTMLElement;
                }
                break;
            case BMPresentationControllerAnchorKind.Selector:
                // For selector, find the element according to the selector
                const node = document.querySelector(this.anchor) as DOMNode;
                if (node) {
                    args.fromNode = node;
                }
                break;
            case BMPresentationControllerAnchorKind.Widget:
                // For widget, find the widget based on its display name
                const widget = BMFindWidget({named: this.anchor, inMashup: this.mashup});
                if (widget) {
                    args.fromNode = widget.boundingBox[0];
                }
                break;
        }

        await this.mashupDefinitionPromise;

        this.anchorNode = args.fromNode;
        this.anchorPoint = args.fromRect && args.fromRect.origin;

        // Add the close/fullscreen buttons if they were selected
        if (this.closeButton) {
            this.createToolbarButtonWithClass('BMWindowControllerCloseButton', {forWindow: popup, content: '<i class="material-icons">&#xE5CD;</i>', action: () => {
                popup.dismissAnimated(YES, {toRect: args.fromRect, toNode: args.fromNode});
            }});
        }
        else if (this.fullScreenButton) {
            this.createToolbarButtonWithClass('BMWindowControllerCloseButton BMWindowControllerCloseButtonDisabled', {forWindow: popup, content: '<i class="material-icons">&#xE5CD;</i>', action: () => void 0});
        }

        if (this.fullScreenButton) {
            this.createToolbarButtonWithClass('BMWindowControllerFullScreenButton', {forWindow: popup, content: '<i class="material-icons">add</i>', action: () => {
                if (popup.isFullScreen) {
                    popup.exitFullScreenAnimated(YES);
                }
                else {
                    popup.enterFullScreenAnimated(YES);
                }
            }});
        }

        popup.node.classList.add('BMWindowControllerWindow');
        
        this.controller = popup;
        popup.delegate = this;
        popup.bringToFrontAnimated(YES, args);
        this.createMashup();

        if (this.modal) {
            window.addEventListener('resize', this.resizeListener = event => {
                const frame = popup.frame;
                frame.center = BMPointMake(window.innerWidth / 2 | 0, window.innerHeight / 2 | 0);
                popup.frame = frame;
            });
        }

    }
    
}