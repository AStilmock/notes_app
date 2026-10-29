class NotePad < ApplicationRecord
  include Positioned

  belongs_to :user
end
