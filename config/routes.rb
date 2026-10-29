Rails.application.routes.draw do
  resource :session
  resources :passwords, param: :token
  resource :registration, only: %i[new create]
  resources :note_pads, only: %i[index show create update destroy]
  resources :spread_sheets, only: %i[index show create update destroy]
  root "note_pads#index"

  get "up" => "rails/health#show", as: :rails_health_check

  # PWA: installable app + offline support (app/views/pwa/)
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
end
