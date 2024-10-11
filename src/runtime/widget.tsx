import {
  React,
  ReactRedux,
  AllWidgetProps,
  getAppStore,
  IMState,
  DataSourceManager,
  DataSourceComponent
} from 'jimu-core';
import { QueryParams, FeatureLayerDataSource } from 'jimu-core/data-source';

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
import SpatialReference from 'esri/geometry/SpatialReference'
import MapView          from 'esri/views/MapView'
import Point            from 'esri/geometry/Point'

const { useEffect, useRef, useState, useCallback } = React;
const { useSelector } = ReactRedux;

const Widget = (props: AllWidgetProps<IMConfig>) => {
  
  const [isProcessing, setIsProcessing] = useState(false);
  const {        
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
      setJimuView(jmvObj);
      mapViewRef.current = jmvObj.view;
      setMapView(jmvObj.view as MapView);
    }
  };

  useEffect(() => {
    if (jimuView) {

      reactiveUtils
        .whenOnce(() => jimuView.view.ready)
        .then(() => {
          console.log('MapView is ready.');
          setMapLoad(true);
          projection.load();

          getAccessToken();    
          loadTraceList();     
        
        });
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
    // 依 trace 模式
    if( selectedTraceType == 'downstream' ) {
      if( startPoint == "" ) {
        closeLoading();
        alert("尚未設定起點");
        return;
      }
      else {
         formData.append("traceGlobalId", "");
         formData.append("locationGlobalId", startPoint);
      }
    }
    else {
      formData.append("traceGlobalId", traceGlobalId);
      //formData.append("locationGlobalId", "{B08DBDAB-6356-4288-961B-9640285F57C8}");
      formData.append("locationGlobalId", "");
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", serverProgRootURL+"/trace", true);
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200) {
        if( xhr.responseText.includes("error") ) {
            closeLoading();
            let err_msg = truncXML(xhr.responseText);
            alert("此處無法trace");
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

    // 除 highlight 外，額外加 selected 給其他 widget 使用
    applyFilterToDataSources(globalIds);
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
              uid: feature.attributes.uid,
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
      alert("並無 trace 到任何資料");
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

  const [selectedTraceType, setSelectedTraceType] = useState('subnetwork');

  const handleTraceTypeChange = (event) => {
    setSelectedTraceType(event.target.value);
  };

  const mapViewRef = useRef(null);
  const clickHandlerRef = useRef();
  const [startPoint, setStartPoint] = useState('');
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);

  const handleGetStartPointClick = () => {
    setIsButtonDisabled(true);
    if (clickHandlerRef.current) {
      clickHandlerRef.current.remove();
    }
    clickHandlerRef.current = mapViewRef.current.on("click", handleMapClick);
  };

  const handleMapClick = async (event) => {

    const screenPoint = {
        x: event.x,
        y: event.y
    };

    const response = await mapViewRef.current.hitTest(screenPoint);
    const results = response.results;

    if (results.length > 0) {
      const graphic = results[0].graphic;
      const point = graphic.geometry;
      const point_3826 = new Point({
        x: point.x,
        y: point.y,
        spatialReference: 3826
      });
      const point_4326 = projection.project(point_3826, SpatialReference.WGS84);

      const attributes = graphic.attributes;
      if (attributes) {
        const objectId = attributes.objectid; 
        const layerId = results[0].layer.layerId;

        if (objectId && layerId) {
          queryForGlobalId(layerId+"", objectId+"");
        }
      }
    }

    if (clickHandlerRef.current) {
      clickHandlerRef.current.remove();
    }
    setIsButtonDisabled(false);
  };

  const queryForGlobalId = (layerId:string, objectId:string) => {
    const formData = new FormData();
    formData.append("layerId", layerId);
    formData.append("objectId", objectId);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", serverProgRootURL+"/queryForGlobalId", true);
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200) {
        if( xhr.responseText.includes("error") ) {
          let err_msg = truncXML(xhr.responseText);
          alert("搜尋 globalId 失敗，訊息:"+err_msg);
        }
        else
        {
          let globalid = truncXML(xhr.responseText);
          setStartPoint(`${globalid}`);
        }
      }
    };
    xhr.send(formData);
  };

  /////////////////////////////////////////////////////////
  // 處理 DataSource  

  const savedDataSources = useRef({}); 

  const onDataSourceCreated = (dataSource: DataSource) => {
    savedDataSources.current[dataSource.id] = dataSource;
  };

  // 額外加的 selected feature 供其他 widget 獲得 trace 成果 
  const applyFilterToDataSources = (globalIds) => {

    Object.values(savedDataSources.current).forEach((dataSource) => {
      if (dataSource) {
        const geometryType = dataSource.getGeometryType();
        if (geometryType === 'esriGeometryPoint' || geometryType === 'esriGeometryPolyline' || geometryType === 'esriGeometryPolygon') {
          const queryParams = {
            where: `globalid IN ('${globalIds.join("','")}')`
          } as QueryParams;

          // 執行查詢後 select
          dataSource.query(queryParams).then((result) => {
            if (result.records.length > 0) {
              //console.log('查詢成功:', result.records);

              dataSource.selectRecordsByIds(result.records.map(record => record.getId()));
            } else {
              //console.log('無查詢結果');
            }
          }).catch(error => {
            //console.error('查詢失敗:', error);
          });
        }
      }

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
          {props.useDataSources.map((ds, index) => (
            <DataSourceComponent
              key={index}
              useDataSource={ds}
              onDataSourceCreated={onDataSourceCreated}
            />
          ))}

          <div style={{ width: '100%' }}>
            <label style={{ marginRight: '10px' }}>
              <input
                type="radio"
                name="options"
                value="subnetwork"
                checked={selectedTraceType === 'subnetwork'}
                onChange={handleTraceTypeChange}
              />
              子網模式
            </label>
            <label>
              <input
                type="radio"
                name="options"
                value="downstream"
                checked={selectedTraceType === 'downstream'}
                onChange={handleTraceTypeChange}
              />
              起點模式
            </label>
          </div>
          {selectedTraceType === 'subnetwork' && (
            <div id="subnetwork">
              <label>挑選待追蹤子網：</label>
              <select
                title='子網'
                value={traceGlobalId}
                onChange={traceItemChange}
              >
                {
                  traceList.map((trace) => {
                    return (<option key={trace.name} value={trace.globalId}>{trace.name}</option>);
                  });
                }
              </select>
            </div>
          )}
          {selectedTraceType === 'downstream' && (
            <div id="downstream">
              <label>起點 globalId：</label>
              <input
                type="text"
                value={startPoint}
                onChange={(e) => setStartPoint(e.target.value)}
                style={{ marginRight: '5px', width: '300px' }}
              />
              <button 
                onClick={handleGetStartPointClick}
                disabled={isButtonDisabled}
                style={{ 
                  backgroundColor: isButtonDisabled ? 'lightgray' : '',
                  cursor: isButtonDisabled ? 'not-allowed' : 'pointer'
                }}
              >地圖點選</button>
            </div>
          )}
          <button onClick={genSingleDiagram} style={{ marginTop: '5px' }}>產製</button>
          追蹤結果：
          <table border="1">
            <thead>
              <tr>
                <th>uid</th>
                <th>圖層</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {traceFeatures.map( ({ feature, uid, globalId, layerName }, index) => 
                (
                  <tr key={index}>
                    <td>{uid}</td>
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


