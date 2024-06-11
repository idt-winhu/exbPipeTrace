import {
  React,
  ReactRedux,
  AllWidgetProps,
  getAppStore,
  IMState
} from 'jimu-core';
import { JimuMapViewComponent, JimuMapView } from 'jimu-arcgis';
import FeatureLayer from "esri/layers/FeatureLayer";
import IdentityManager from 'esri/identity/IdentityManager';
import reactiveUtils from 'esri/core/reactiveUtils';
import { Alert, Loading } from 'jimu-ui';
import { IMConfig } from '../config';
import './widget.css';
import {
  truncXML,
  createElement
} from './Utils';
import projection       from 'esri/geometry/projection'
import MapView          from 'esri/views/MapView'

const { useEffect, useRef, useState, useCallback } = React;
const { useSelector } = ReactRedux;

const Widget = (props: AllWidgetProps<IMConfig>) => {
  
  const [isProcessing, setIsProcessing] = useState(false);
  const {        
    comboTraceHead,
    serverProgRootURL
  } = props.config;
  const [jimuView, setJimuView] = useState<JimuMapView>(null);
  const [mapView, setMapView] = useState<MapView>(null);
  
  const [mapLoad, setMapLoad] = useState<boolean>(false);

  const widgetState = useSelector((state: IMState) => {
    return state.widgetsRuntimeInfo;
  });

  const activeViewChangeHandler = (jmvObj: JimuMapView) => {
    if (jmvObj) {
      setMapView(jmvObj.view as MapView);
      setJimuView(jmvObj);
      initialWidgets();     // 地圖載入後初始化 widget 資料
    }
  };

  useEffect(() => {
    if (jimuView) {

      reactiveUtils
        .whenOnce(() => jimuView.view.ready)
        .then(() => {
          console.log('MapView is ready.');
        });

      setMapLoad(true);

    }
  }, [jimuView]);
    

  const [ showLoading, setShowLoading ] = useState(false)
  const [ traceList, setTraceList ] = useState([]);
  const [ traceGlobalId, setTraceGlobalId ] = useState('');
  const [ accessToken, setAccessToken ] = useState("");
  const [ globalIds, setGlobalIds ] = useState([]);
  const [ traceFeatures, setTraceFeatures ] = useState([]);
  const [ temporaryHighlight, setTemporaryHighlight ] = useState(null);

  const openLoading = () =>{
    setShowLoading(true);
  }
  const closeLoading = () =>{
    setShowLoading(false);
  }

  // 初始化元件
  const initialWidgets = () => {
    projection.load();   // 座標轉換工具載入
    getAccessToken();    // 取得 token 之後用
    loadTraceList();     // 載入軌跡 select 項目
  }

  // 取得 token 之後用
  const getAccessToken = () =>{
    // widget 上層已登入過，此處暫不需
  }

  // 載入軌跡 select 項目
  const loadTraceList = () =>{
    if (traceList.length)       // 已有資料不再讀取
      return;

    openLoading();

    // http 取下可選取軌跡
    const xhr = new XMLHttpRequest();
    xhr.open("GET", serverProgRootURL+"/getTraceItems", true);
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200) {
        if( xhr.responseText.includes("error") ) {
            closeLoading();
            let err_msg = truncXML(xhr.responseText);
            alert("查詢失敗，訊息:"+err_msg);
        }
        else {
            let result = truncXML(xhr.responseText);
            //alert("更新查詢記錄完成，按鍵後繼續");
            const jsonResult = JSON.parse(result);
            if( jsonResult.length==0 ) {
                closeLoading();
                alert("此條件目前無任何資料");
            }
            else {
                // 解譯各軌跡待選取
                let traceItems = [];
                for( let ii=0; ii<jsonResult.length; ii++ ) {
                    traceItems.push({
                        globalId: jsonResult[ii].globalId,
                        name: jsonResult[ii].name
                    });
                }
                const sortedTraceItems = traceItems.sort((a, b) => {
                  if (a.name < b.name) return -1;
                  if (a.name > b.name) return 1;
                  return 0;
                });
                setTraceList(sortedTraceItems);
                setTraceGlobalId(traceItems[0].globalId+','+traceItems[0].name);
                closeLoading();
            }
        }
      }
    };
    xhr.send();
    
  }

  // 軌跡選取變更 event
  const traceItemChange = (e:any) => {
    let globalId = e.currentTarget.value;
    fireAfterTraceItemChange(globalId);    
  }

  const fireAfterTraceItemChange = (globalId:string) => {
    setTraceGlobalId(globalId);   // 暫僅需保留系統變數
  }

  // 產製單線圖
  const genSingleDiagram = () => {

    openLoading();

    // 先呼叫 trace service 取得追蹤後各設備 globalId，接著才用這些 globalId 產生簡圖
    const formData = new FormData();
    formData.append("traceGlobalId", traceGlobalId);
    formData.append("locationGlobalId", "{57297DF8-B6B9-49FB-9A4D-E7112623297C}");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", serverProgRootURL+"/trace", true);
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200) {
        if( xhr.responseText.includes("error") ) {
            closeLoading();
            let err_msg = truncXML(xhr.responseText);
            alert("查詢失敗，訊息:"+err_msg);
        }
        else {
            let result = truncXML(xhr.responseText);
            //alert("trace service response:"+result+" from globalId:"+traceGlobalId);
            createSingleDiagram(result);
        }
      }
    };
    xhr.send(formData);
  };

  const highlightHandles = useRef([]);

  const highlightFeatures = (globalIds) => {
    clearPreviousHighlights();

    const layers = mapView.map.allLayers._items;
    layers.forEach(layer => {
      if (layer.type === 'feature') {
        queryLayerToHighLight(layer, globalIds);
      }
    });
  };

  const clearPreviousHighlights = () => {
    highlightHandles.current.forEach(handle => handle.remove());
    highlightHandles.current = [];
    setTraceFeatures([]);
    //if (temporaryHighlight) {
    //  temporaryHighlight.remove();
    //  setTemporaryHighlight(null);
    //}
  };

  const queryLayerToHighLight = (layer, globalIds) => {
    const query = layer.createQuery();
    query.where = `globalid IN ('${globalIds.join("','")}')`;

    layer.queryFeatures(query).then(results => {
      if (results.features.length > 0) {
        mapView.whenLayerView(layer).then(layerView => {

          const highlight = layerView.highlight(results.features);
          highlightHandles.current.push(highlight);

          setTraceFeatures(prevFeatures => [
            ...prevFeatures,
            ...results.features.map(feature => ({
              layer,
              feature,
              globalId: feature.attributes.globalid,
              layerName: layer.title || layer.id
            }))
          ]);

        }).catch(error => {
          console.error("Error getting layerView: ", error);
        });
      }
    }).catch(error => {
      console.error("Query error: ", error);
    });
  };

  const createSingleDiagram = (initialFeatures:string) => {

    // 製簡易圖前先亮顯此些 features
    const ids = JSON.parse(initialFeatures);
    if (Array.isArray(ids)) {
      setGlobalIds(ids);
      highlightFeatures(ids);
    } else {
      alert("並無 trace 到任何 globalid");
      return;
    }

    const formData = new FormData();
    formData.append("initialFeatures", initialFeatures);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", serverProgRootURL+"/createSingleDiagram", true);
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200) {
        if( xhr.responseText.includes("error") ) {
            closeLoading();
            let err_msg = truncXML(xhr.responseText);
            alert("查詢失敗，訊息:"+err_msg);
        }
        else {
            let diagram_name = truncXML(xhr.responseText);
            //alert("create diagram service response name:"+diagram_name);
            exportSingleDiagram(diagram_name);
        }
      }
    };
    xhr.send(formData);

  };

  const exportSingleDiagram = (diagram_name:string) => {

    const formData = new FormData();
    formData.append("diagram_name", diagram_name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", serverProgRootURL+"/exportSingleDiagram", true);
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200) {
        if( xhr.responseText.includes("error") ) {
            closeLoading();
            let err_msg = truncXML(xhr.responseText);
            alert("查詢失敗，訊息:"+err_msg);
        }
        else {
            closeLoading();
            let href = truncXML(xhr.responseText);
            window.open(href,"_blank", "toolbar=1, scrollbars=1, resizable=1, width=" + 1000 + ", height=" + 700);
        }
      }
    };
    xhr.send(formData);

  };

  const zoomToFeature = (feature) => {
    const { geometry, layer } = feature;

    mapView.goTo({
      target: geometry,
      zoom: 12
    }).then(() => {

      const popupLocation = geometry.extent ? geometry.extent.center : geometry;
      mapView.popup.open({
        features: [feature],
        location: popupLocation
      });
    });

    mapView.whenLayerView(layer).then(layerView => {

      //highlightHandles.current.forEach(handle => handle.remove());
      //if (temporaryHighlight) {
      //  temporaryHighlight.remove();
      //}

      //const tempHighlight = layerView.highlight([feature]);
      //setTemporaryHighlight(tempHighlight);

      //setTimeout(() => {
      //  tempHighlight.remove();
      //  highlightFeatures(globalIds);
      //}, 5000); 
    });
  };

  return (
    <div className="jimu-widget">
      {props.useMapWidgetIds && props.useMapWidgetIds.length === 1 && (
        <JimuMapViewComponent
          useMapWidgetId={props.useMapWidgetIds?.[0]}
          onActiveViewChange={activeViewChangeHandler}
        />
      )}
      <div className="alert-box">
        <Alert
          // closable
          form="basic"
          onClose={() => {}}
          open={!mapLoad}
          text={'右側地圖選取中尚未選取地圖'}
          type="info"
          withIcon
        />
      </div>
      {jimuView !== null && (
        <div className='sensitive-iqy-loading'>
          <Loading className={showLoading ? 'show' : ''} />
        </div>
      )}
      {jimuView !== null && (
        <div className="main-grid" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <label>{comboTraceHead}</label>
          <select
            title={comboTraceHead}
            value={traceGlobalId}
            onChange={traceItemChange}
          >
            {
              traceList.map((trace) => {
                return (<option key={trace.name} value={trace.globalId}>{trace.name},{trace.globalId}</option>);
              });
            }
          </select>
          <button onClick={genSingleDiagram}>產製</button>
          追蹤結果：
          <table border="1">
            <thead>
              <tr>
                <th>globalid</th>
                <th>圖層</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {traceFeatures.map( ({ feature, globalId, layerName }, index) => 
                (
                  <tr key={index}>
                    <td>{globalId}</td>
                    <td>{layerName}</td>
                    <td>
                      <button onClick={() => zoomToFeature(feature)}>移至此</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
      {jimuView === null && (
        <div>
          <Loading />
        </div>
      )}
    </div>
  );
};

export default Widget;


