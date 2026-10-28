Rails.application.routes.draw do
  resource :session
  resources :passwords, param: :token
  resource :registration, only: %i[new create]
  resources :note_pads, only: %i[index show create update destroy]
  resources :spread_sheets, only: %i[index show create update destroy]
  root "note_pads#index"

  get "up" => "rails/health#show", as: :rails_health_check
end
