// Kakao Maps JavaScript SDK 최소 타입 정의 (실제 사용 범위만).
// 공식 SDK는 타입 파일을 제공하지 않아 자체 선언함.
// 전체 API가 아니라 도시공존에서 호출하는 부분만 — 새 API 쓰면 여기 추가.

export type KakaoStatus = "OK" | "ZERO_RESULT" | "ERROR";

export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

export interface KakaoMap {
  getCenter(): KakaoLatLng;
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
  getLevel(): number;
  relayout(): void;
  panTo(latlng: KakaoLatLng): void;
}

export interface KakaoMapMouseEvent {
  latLng: KakaoLatLng;
}

// services.Geocoder — coord2RegionCode 응답 1건
export interface KakaoRegionResult {
  region_type: "H" | "B"; // H=행정동, B=법정동
  code: string;
  region_1depth_name: string;
  region_2depth_name: string;
  region_3depth_name: string;
  region_4depth_name?: string;
  x: number;
  y: number;
}

// services.Geocoder — addressSearch 응답 1건
export interface KakaoAddressResult {
  address_name: string;
  address?: {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
  } | null;
  road_address?: {
    address_name: string;
    road_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
  } | null;
  x: string;
  y: string;
}

export interface KakaoGeocoder {
  coord2RegionCode(
    lng: number,
    lat: number,
    callback: (result: KakaoRegionResult[], status: KakaoStatus) => void,
  ): void;
  addressSearch(
    address: string,
    callback: (result: KakaoAddressResult[], status: KakaoStatus) => void,
  ): void;
}

// services.Places — keywordSearch 응답 1건
export interface KakaoPlaceResult {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  phone: string;
  place_url: string;
  x: string;
  y: string;
}

export interface KakaoPlaces {
  keywordSearch(
    query: string,
    callback: (data: KakaoPlaceResult[], status: KakaoStatus) => void,
  ): void;
}

export interface KakaoStatusEnum {
  OK: KakaoStatus;
  ZERO_RESULT: KakaoStatus;
  ERROR: KakaoStatus;
}

export interface KakaoMapsServices {
  Geocoder: new () => KakaoGeocoder;
  Places: new () => KakaoPlaces;
  Status: KakaoStatusEnum;
}

// event.addListener — 핸들러 인자는 이벤트마다 다름.
// 주로 mouse 이벤트(latLng 포함) 쓰니까 KakaoMapMouseEvent로 캐스팅해서 사용.
// idle 같은 인자 없는 이벤트는 () => void.
export interface KakaoMapsEvent {
  addListener<T = unknown>(
    target: unknown,
    eventName: string,
    handler: (event: T) => void,
  ): void;
  removeListener(target: unknown, eventName: string, handler: (...args: unknown[]) => void): void;
}

export interface KakaoMapOptions {
  center: KakaoLatLng;
  level: number;
}

// CustomOverlay — 임의 HTML을 지도 위에 절대 좌표로 띄우는 오버레이
export interface KakaoCustomOverlayOptions {
  map?: KakaoMap | null;
  position: KakaoLatLng;
  content: HTMLElement | string;
  xAnchor?: number;
  yAnchor?: number;
  zIndex?: number;
  clickable?: boolean;
}

export interface KakaoOverlay {
  setMap(map: KakaoMap | null): void;
  setPosition(position: KakaoLatLng): void;
  getPosition(): KakaoLatLng;
}

// Circle — 반경 표시
export interface KakaoCircleOptions {
  map?: KakaoMap | null;
  center: KakaoLatLng;
  radius: number;
  strokeWeight?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeStyle?: "solid" | "dashed" | "dot" | "longdash" | "shortdash";
  fillColor?: string;
  fillOpacity?: number;
}

export interface KakaoCircle {
  setMap(map: KakaoMap | null): void;
  setCenter(latlng: KakaoLatLng): void;
  setRadius(radius: number): void;
}

export interface KakaoMaps {
  load(callback: () => void): void;
  Map: new (container: HTMLElement, options: KakaoMapOptions) => KakaoMap;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  CustomOverlay: new (options: KakaoCustomOverlayOptions) => KakaoOverlay;
  Circle: new (options: KakaoCircleOptions) => KakaoCircle;
  event: KakaoMapsEvent;
  services: KakaoMapsServices;
}

export interface KakaoNamespace {
  maps: KakaoMaps;
}

declare global {
  interface Window {
    kakao: KakaoNamespace;
  }
}
